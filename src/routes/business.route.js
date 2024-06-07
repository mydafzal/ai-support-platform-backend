const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const sequelize = require("sequelize");

const {
  Assistant,
  Business,
  User,
  Invitation,
  Url,
  Document,
  TeamGroup,
  Call,
  CallTag,
  Integration,
  BusinessIntegration,
  Chat,
  ChatWidget,
  ChatGroupAssignment,
  ChatUserAssignment,
} = require("../../models");

const { convertTextToSpeech } = require("../integrations/textToSpeech");

const router = require("express").Router();
const fs = require("fs/promises");
const fsWithoutPromises = require("fs");

const jwt = require("jsonwebtoken");

const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_BASE_URL,
} = require("../utils/constants");
const { Sequelize } = require("sequelize");

const { redisClient } = require("../integrations/redis");

const businessDetailsValidationSchema = z.object({
  userId: z.number(),
  businessName: z.string(),
  assistantName: z.string(),
  voiceId: z.string(),
  voiceName: z.string(),
  greetingMessage: z.string(),
  farewellMessage: z.string(),
});

const updateBusinessDetailsValidationSchema = z.object({
  businessName: z.string().optional(),
  assistantName: z.string().optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().optional(),
  greetingMessage: z.string().optional(),
  farewellMessage: z.string().optional(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await businessDetailsValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const {
      userId,
      businessName,
      assistantName,
      voiceName,
      voiceId,
      greetingMessage,
      farewellMessage,
    } = req.body;

    let user = await User.findByPk(userId, {
      attributes: {
        exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
      },
    });

    user = user?.toJSON();

    if (!user.email) {
      return res.status(404).json({
        succcess: false,
        message: "User with the given id does not exist.",
      });
    }

    const twilioNumber = await buyPhoneNumber();
    const verifyServiceId = await createVerifyService(businessName);

    let business = await Business.create({
      name: businessName,
      // twilioNumber: "+14697074725",
      twilioNumber: twilioNumber || "+14697074725",
      verifyServiceId,
      adminUserId: userId,
    });

    business = business.toJSON();

    await User.update(
      {
        businessId: business.id,
        role: "Admin",
      },
      {
        where: { id: userId },
      }
    );

    let promises = [
      convertTextToSpeech(greetingMessage, voiceId),
      convertTextToSpeech(farewellMessage, voiceId),
    ];

    let [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    greetingMessageSpeech = Buffer.from(greetingMessageSpeech);
    farewellMessageSpeech = Buffer.from(farewellMessageSpeech);

    const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${business.id}`;
    await fs.mkdir(businessDataDirectoryPath, {
      recursive: true,
    });

    promises = [
      fs.writeFile(
        `${businessDataDirectoryPath}/greetingMessage.mp3`,
        greetingMessageSpeech
      ),
      fs.writeFile(
        `${businessDataDirectoryPath}/farewellMessage.mp3`,
        farewellMessageSpeech
      ),
    ];

    await Promise.all(promises);

    const greetingMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${business.id}/greetingMessage.mp3`;
    const farewellMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${business.id}/farewellMessage.mp3`;

    await Assistant.create({
      businessId: business.id,
      name: assistantName,
      voiceName,
      voiceId,
      greetingMessageUrl,
      farewellMessageUrl,
      greetingMessage,
      farewellMessage,
      knowledgeBaseName: uuidv4(),
    });

    user = await User.findOne({
      where: {
        id: userId,
      },
      include: [
        {
          model: Business,
          as: "business",
          include: [
            {
              model: Assistant,
              as: "assistant",
            },
          ],
        },
      ],
    });

    user = user.toJSON();

    const token = jwt.sign(
      {
        ...user,
      },
      process.env.JWT_SECRET
    );

    res.status(201).json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error("Error adding business:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { success, error } =
      await updateBusinessDetailsValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const businessId = req.params.id;

    let count = await Business.count({
      where: {
        id: businessId,
      },
    });

    if (count <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id." });
    }

    let {
      businessName,
      assistantName,
      voiceName,
      voiceId,
      greetingMessage,
      farewellMessage,
    } = req.body;

    if (businessName) {
      await Business.update(
        {
          name: businessName,
        },
        {
          where: {
            id: businessId,
          },
        }
      );
    }

    let assistant = await Assistant.findOne({
      where: {
        businessId,
      },
    });
    assistant = assistant.toJSON();

    let greetingMessageUrl = assistant.greetingMessageUrl;
    let farewellMessageUrl = assistant.farewellMessageUrl;
    voiceId = voiceId || assistant.voiceId;

    console.log("voice id -", voiceId);

    if (greetingMessage) {
      let greetingMessageSpeech = await convertTextToSpeech(
        greetingMessage,
        voiceId
      );
      greetingMessageSpeech = Buffer.from(greetingMessageSpeech);

      console.log("speech - ", greetingMessage);

      const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${businessId}`;

      const exists = fsWithoutPromises.existsSync(
        `${businessDataDirectoryPath}/greetingMessage.mp3`
      );

      if (exists) {
        await fs.unlink(`${businessDataDirectoryPath}/greetingMessage.mp3`);
      }

      await fs.writeFile(
        `${businessDataDirectoryPath}/greetingMessage.mp3`,
        greetingMessageSpeech
      );

      greetingMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${businessId}/greetingMessage.mp3`;
    }

    if (farewellMessage) {
      let farewellMessageSpeech = await convertTextToSpeech(
        farewellMessage,
        voiceId
      );
      farewellMessageSpeech = Buffer.from(farewellMessageSpeech);

      console.log("speech - ", farewellMessageSpeech);

      const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${businessId}`;

      const exists = fsWithoutPromises.existsSync(
        `${businessDataDirectoryPath}/farewellMessage.mp3`
      );

      if (exists) {
        await fs.unlink(`${businessDataDirectoryPath}/farewellMessage.mp3`);
      }

      await fs.writeFile(
        `${businessDataDirectoryPath}/farewellMessage.mp3`,
        farewellMessageSpeech
      );

      farewellMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${businessId}/farewellMessage.mp3`;
    }

    assistantName = assistantName || assistant.name;
    voiceName = voiceName || assistant.voiceName;
    greetingMessage = greetingMessage || assistant.greetingMessage;
    farewellMessage = farewellMessage || assistant.farewellMessage;

    await Assistant.update(
      {
        name: assistantName,
        voiceId,
        voiceName,
        greetingMessage,
        farewellMessage,
      },
      {
        where: { businessId },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        businessId,
        businessName,
        assistantName,
        voiceName,
        voiceId,
        greetingMessage,
        farewellMessage,
        greetingMessageUrl,
        farewellMessageUrl,
      },
      message: "Business information updated successfully.",
    });
  } catch (error) {
    console.error("Error updating business information:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/documents", async (req, res) => {
  const businessId = req.params.id;
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
        businessId,
      },
      limit: parseInt(pageSize),
      offset: parseInt(offset),
    });

    const totalCount = await Document.count({
      where: {
        businessId,
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
  const businessId = req.params.id;
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
        businessId,
      },
      limit: parseInt(pageSize),
      offset: parseInt(offset),
    });

    const totalCount = await Url.count({
      where: {
        businessId,
      },
    });

    const basePath = `${process.env.BASE_URL}/data/documents/${businessId}`;

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

router.get("/:id/train-chat-messages", async (req, res) => {
  const businessId = req.params.id;

  try {
    let result = await redisClient.lRange(`train-chat-${businessId}`, 0, -1);

    result = result.map((item) => {
      item = JSON.parse(item);

      return {
        type: item.type,
        content: item.data.content,
        timestamp: item.data?.additional_kwargs?.timestamp,
      };
    });

    res.status(200).json({ success: true, data: result?.reverse() });
  } catch (error) {
    console.error("Error getting train chat's messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/chats", async (req, res) => {
  try {
    let chats = await Chat.findAll({
      where: { businessId: req.params.id },
      include: [
        {
          model: User,
          attributes: ["id", "name", "profileImageUrl"],
          as: "users",
          through: {
            attributes: [],
          },
        },
        {
          model: TeamGroup,
          attributes: ["id", "name"],
          as: "teamGroups",
          through: {
            attributes: [],
          },
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    chats = await Promise.all(
      chats.map(async (chat) => {
        chat = chat.toJSON();
        const lastMessage = await redisClient.lIndex(`chat-${chat.id}`, -1);

        if (lastMessage) {
          chat.lastMessage = JSON.parse(lastMessage);
        }

        let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);

        const unreadMessages = messages.filter((message) => {
          message = JSON.parse(message);
          return message.status === "Delivered" && !message.senderId;
        });

        chat.unreadMessagesCount = unreadMessages.length;
        return chat;
      })
    );

    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    console.error("Error getting chats:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/team-groups", async (req, res) => {
  const businessId = req.params.id;

  try {
    let teamGroups = await TeamGroup.findAll({
      where: { businessId },
      attributes: [
        "id",
        "name",
        [sequelize.fn("COUNT", sequelize.col("users.id")), "userCount"],
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Invitations"
            WHERE "Invitations"."teamGroupId" = "TeamGroup"."id"
            AND NOT EXISTS (
              SELECT 1
              FROM "Users"
              WHERE "Users"."teamGroupId" = "TeamGroup"."id"
              AND "Users"."email" = "Invitations"."email"
            )
          )`),
          "invitationCount",
        ],
        [sequelize.fn("COUNT", sequelize.col("chats.id")), "chatCount"],
      ],
      include: [
        {
          model: User,
          as: "users",
          attributes: [],
        },
        {
          model: Invitation,
          as: "invitations",
          attributes: [],
        },
        {
          model: Chat,
          attributes: [],
          as: "chats",
          through: {
            attributes: [],
          },
        },
      ],
      group: ["TeamGroup.id"],
    });

    teamGroups = teamGroups.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: teamGroups });
  } catch (error) {
    console.error("Error getting team groups:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/calls", async (req, res) => {
  let { page = 1, pageSize = 10, callTagId } = req.query;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  try {
    const offset = (page - 1) * pageSize;

    let whereCondition = { businessId: req.params.id };
    if (callTagId) {
      whereCondition.callTagId = callTagId;
    }

    let calls = await Call.findAll({
      where: whereCondition,
      limit: parseInt(pageSize),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    const totalCount = await Call.count({
      where: whereCondition,
    });

    calls = calls.map((item) => item.toJSON());

    calls = await Promise.all(
      calls.map(async (call) => {
        let messages = await redisClient.lRange(
          `transcription-${call.id}`,
          0,
          -1
        );

        messages = messages.map((item) => {
          item = JSON.parse(item);

          console.log("item - ", item);

          return {
            type: item.type === "ai" ? item.type : "human",
            content: item?.data?.content || item.kwargs.content,
            timestamp: item.data?.additional_kwargs?.timestamp,
          };
        });

        return {
          ...call,
          transcription: messages?.reverse(),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: calls,
      pagination: { page, pageSize, totalCount },
    });
  } catch (error) {
    console.error("Error getting calls:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/call-tags", async (req, res) => {
  try {
    let callTags = await CallTag.findAll({
      where: { businessId: req.params.id },
    });

    callTags = callTags.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: callTags });
  } catch (error) {
    console.error("Error getting call tags:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/integrations", async (req, res) => {
  const businessId = req.params.id;

  const { recommended } = req.query;

  let whereCondition = {};
  if (recommended == "true") {
    whereCondition.recommended = true;
  }

  try {
    let integrations = await Integration.findAll({
      where: whereCondition,
      include: [
        {
          model: BusinessIntegration,
          as: "integration",
          where: { businessId },
          attributes: [],
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.literal(
              'CASE WHEN "integration"."businessId" IS NOT NULL THEN true ELSE false END'
            ),
            "connected",
          ],
          [Sequelize.col("integration.id"), "businessIntegrationId"],
        ],
      },
    });

    integrations = integrations.map((item) => item.toJSON());
    res.status(200).json({ success: true, data: integrations });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/team", async (req, res) => {
  const businessId = req.params.id;

  try {
    let users = await User.findAll({
      where: {
        businessId,
      },
      attributes: {
        exclude: [
          "password",
          "emailVerificationToken",
          "resetPasswordToken",
          "externalType",
        ],
      },
      include: [
        { model: TeamGroup, as: "teamGroup", attributes: ["name", "id"] },
      ],
    });

    users = users?.map((item) => item.toJSON());

    let whereCondition = {
      businessId,
    };

    if (users?.length > 0) {
      whereCondition.email = {
        [sequelize.Op.notIn]: users.map((item) => item.email),
      };
    }

    let invitations = await Invitation.findAll({
      where: whereCondition,
      attributes: {
        exclude: ["token"],
      },
      include: [
        { model: TeamGroup, as: "teamGroup", attributes: ["name", "id"] },
      ],
    });

    invitations = invitations?.map((item) => item.toJSON());

    const teamMembers = [...users, ...invitations];
    res.status(200).json({ success: true, data: teamMembers });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/chat-widgets", async (req, res) => {
  const businessId = req.params.id;

  try {
    let chatWidget = await ChatWidget.findOne({
      where: {
        businessId,
      },
    });

    if (!chatWidget) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid chat widget id." });
    }

    res.status(200).json({ success: true, data: chatWidget });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id/chats", async (req, res) => {
  const businessId = req.params.id;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid business id." });
    }

    await Chat.destroy({
      where: {
        businessId,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
