const router = require("express").Router();
const User = require("../models/user.model");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const { z } = require("zod");
const Document = require("../models/document.model");
const Url = require("../models/url.model");
const { redisClient } = require("../integrations/redis");
const Chat = require("../models/chat.model");

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  externalType: z.enum(["Google", "Apple", ""]).optional(),
  externalId: z.string().optional(),
  name: z.string().optional(),
});

router.post("/", async (req, res) => {
  const { name, email, password, externalId, externalType } = req.body;
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

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      externalId: externalId || null,
      externalType: externalType || null,
    });

    res.status(201).json({ success: true, data: user.toJSON() });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/documents", async (req, res) => {
  try {
    let documents = await Document.findAll({
      where: {
        userId: req.params.id,
      },
    });

    documents = documents.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/urls", async (req, res) => {
  try {
    let urls = await Url.findAll({
      where: {
        userId: req.params.id,
      },
    });

    urls = urls.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: urls });
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

module.exports = router;
