const router = require("express").Router();
const User = require("../models/user.model");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");

const { z } = require("zod");
const Document = require("../models/document.model");
const Url = require("../models/url.model");
const { redisClient } = require("../integrations/redis");
const Chat = require("../models/chat.model");
const Call = require("../models/call.model");
const CallGroup = require("../models/callGroup.model");
const Integration = require("../models/integration.model");
const { sendEmail } = require("../integrations/nodemailer");
const TeamMember = require("../models/teamMember.model");
const TeamGroup = require("../models/teamGroup.model");

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4).optional(),
  name: z.string(),
});

router.post("/", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("add user", req.body);

  try {
    const { success, error } = await userValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (user?.toJSON()?.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists." });
    }

    let hashedPassword;
    if (password?.length > 0) {
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    await User.create({
      name,
      email,
      password: hashedPassword,
    });

    user = await User.findOne({
      where: {
        email,
      },
      attributes: {
        exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
      },
    });

    const emailVerificationToken = jwt.sign(
      { userId: user.toJSON().id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    user.emailVerificationToken = emailVerificationToken;
    await user.save();

    user = user.toJSON();

    const emailLink = `${req.hostname}/email-verification?token=${user.emailVerificationToken}`;
    await sendEmail(user.email, emailLink);

    const token = jwt.sign({ ...user }, process.env.JWT_SECRET);

    res.status(201).json({
      success: true,
      data: token,
      message: "Email verification link sent.",
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/documents", async (req, res) => {
  const userId = req.params.id;
  let { page = 1, pageSize = 10 } = req.query;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  try {
    const offset = (page - 1) * pageSize;

    let documents = await Document.findAll({
      where: {
        userId,
      },
      limit: parseInt(pageSize),
      offset: parseInt(offset),
    });

    const totalCount = await Document.count({
      where: {
        userId,
      },
    });

    documents = documents.map((item) => item.toJSON());

    res.status(200).json({
      success: true,
      data: documents,
      pagination: { page, pageSize, totalCount },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/urls", async (req, res) => {
  const userId = req.params.id;
  let { page = 1, pageSize = 10 } = req.query;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  try {
    const offset = (page - 1) * pageSize;

    let urls = await Url.findAll({
      where: {
        userId,
      },
      limit: parseInt(pageSize),
      offset: parseInt(offset),
    });

    const totalCount = await Url.count({
      where: {
        userId,
      },
    });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const basePath = `${baseUrl}/data/documents/${userId}`;

    urls = urls.map((item) => {
      item = item.toJSON();

      return {
        ...item,
        previewUrl: `${basePath}/url-${item.id}-preview.png`,
      };
    });

    res.status(200).json({
      success: true,
      data: urls,
      pagination: { page, pageSize, totalCount },
    });
  } catch (error) {
    console.error("Error getting urls:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/teach-chat-messages", async (req, res) => {
  const userId = req.params.id;

  try {
    let result = await redisClient.lRange(`teach-chat-${userId}`, 0, -1);

    console.log("result", JSON.parse(result[0]).data);

    result = result.map((item) => {
      item = JSON.parse(item);

      return {
        type: item.type,
        content: item.data.content,
        timestamp: item.data?.additional_kwargs?.timestamp,
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error getting teach chat's messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/chats", async (req, res) => {
  try {
    let chats = await Chat.findAll({
      where: { userId: req.params.id },
    });

    if (chats.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    chats = await Promise.all(
      chats.map(async (chat) => {
        chat = chat.toJSON();

        let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);

        messages = messages.map((item) => {
          item = JSON.parse(item);

          return {
            type: item.type,
            content: item.data.content,
            timestamp: item.data?.additional_kwargs?.timestamp,
          };
        });

        return {
          title: chat.title,
          messages,
        };
      })
    );

    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    console.error("Error getting chats:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id/chats", async (req, res) => {
  const userId = req.params.id;

  try {
    let chats = await Chat.findAll({
      where: {
        userId,
      },
    });

    await Chat.destroy({
      where: { userId },
    });

    const promises = chats.map((chat) => {
      chat = chat.toJSON();
      return redisClient.del(`chat-${chat.id}`);
    });

    await Promise.all(promises);

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/team-members", async (req, res) => {
  const userId = req.params.id;

  try {
    let teamMembers = await TeamMember.findAll({
      where: {
        userId,
      },
    });

    teamMembers = teamMembers.map((item) => item.toJSON());
    res.status(200).json({ success: true, data: teamMembers });
  } catch (error) {
    console.error("Error getting team members:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/team-groups", async (req, res) => {
  const userId = req.params.id;

  try {
    let teamGroups = await TeamGroup.findAll({
      where: {
        userId,
      },
    });

    teamGroups = teamGroups.map((item) => item.toJSON());
    res.status(200).json({ success: true, data: teamGroups });
  } catch (error) {
    console.error("Error getting team groups:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/calls", async (req, res) => {
  try {
    let calls = await Call.findAll({
      where: { userId: req.params.id },
    });

    calls = calls.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: calls });
  } catch (error) {
    console.error("Error getting calls:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/call-groups", async (req, res) => {
  try {
    let callGroups = await CallGroup.findAll({
      where: { userId: req.params.id },
    });

    callGroups = callGroups.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: callGroups });
  } catch (error) {
    console.error("Error getting calls:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/integrations", async (req, res) => {
  try {
    let integrations = await Integration.findAll({
      where: { userId: req.params.id },
    });

    integrations = integrations.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: integrations });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
