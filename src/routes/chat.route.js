const router = require("express").Router();
const {
  Chat,
  Business,
  Assistant,
  ChatWidget,
  ChatGroupAssignment,
  User,
  TeamGroup,
  BusinessIntegration,
} = require("../../models");

const {
  generateChatbotAgentResponse,
} = require("../controllers/chatbotAgent.controller");

const { z } = require("zod");
const { redisClient } = require("../integrations/redis");

const { Op } = require("sequelize");

const { v4: uuidv4 } = require("uuid");

const multer = require("multer");

const path = require("path");

const { getSocketIOInstance } = require("../loaders/socket-io");
const {
  STORAGE_BASE_PATH,
  CHAT_UPLOADS_BASE_URL,
  CALENDLY_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  CHATS_FEATURE_ID,
} = require("../utils/constants");
const SubscriptionService = require("../services/subscription.service");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `chat-uploads`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

const chatMessageValidationSchema = z.object({
  message: z.string(),
});

const preChatFormValidationSchema = z.object({
  businessId: z.number(),
  name: z.string(),
  email: z.string().email(),
  teamGroupName: z.string().optional(),
  teamGroupId: z.number().optional(),
});

const chatValidationSchema = z.object({
  status: z.string().optional(),
  teamGroupIds: z.array(z.number()).optional(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await preChatFormValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, email, teamGroupId, teamGroupName, businessId } = req.body;

    let chatWidget = await ChatWidget.findOne({
      where: {
        businessId,
      },
    });

    if (!chatWidget) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Please create a chat widget first.",
      });
    }

    chatWidget = chatWidget.toJSON();

    let chat = await Chat.create({
      title: name,
      businessId,
    });

    chat = chat.toJSON();

    if (teamGroupId && teamGroupName) {
      await ChatGroupAssignment.create({
        chatId: chat.id,
        teamGroupId,
      });
    }

    const preChatForm = {
      type: "pre-chat-form",
      content: {
        name,
        email,
        teamGroupId,
        teamGroupName,
      },
      timestamp: new Date().getTime(),
    };

    await redisClient.lPush(`chat-${chat.id}`, JSON.stringify(preChatForm));

    const welcomeMessage = {
      type: "ai",
      content: chatWidget.welcomeMessage,
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chat.id}`, JSON.stringify(welcomeMessage));

    const response = {
      chatId: chat.id,
      messages: [preChatForm, welcomeMessage],
    };

    await SubscriptionService.updateFeatureUsage(
      CHATS_FEATURE_ID,
      businessId,
      1
    );

    res.status(201).json({ success: true, data: response });
  } catch (error) {
    console.error("Error getting chatbot agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.put("/:id/pre-chat-form", async (req, res) => {
  const chatId = req.params.id;

  try {
    const { success, error } = await preChatFormValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, email, teamGroupId, teamGroupName, businessId } = req.body;

    let chatWidget = await ChatWidget.findOne({
      where: {
        businessId,
      },
    });

    if (!chatWidget) {
      return res
        .status(400)
        .json({ success: true, data: "Invalid chat widget id." });
    }

    chatWidget = chatWidget.toJSON();

    if (teamGroupId && teamGroupName) {
      // First, check if the customer again selected the same group.
      let chatGroupAssignment = await ChatGroupAssignment.findOne({
        chatId,
        teamGroupId,
      });

      // If no, then this time the customer's queries belong to a different group (department)
      if (!chatGroupAssignment) {
        await ChatGroupAssignment.create({
          chatId,
          teamGroupId,
        });
      }
    }

    const preChatForm = {
      type: "pre-chat-form",
      content: {
        email,
        name,
        teamGroupId,
        teamGroupName,
      },
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(preChatForm));

    const welcomeMessage = {
      type: "ai",
      content: chatWidget.welcomeMessage,
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(welcomeMessage));

    res
      .status(200)
      .json({ success: true, data: [preChatForm, welcomeMessage] });
  } catch (error) {
    console.error("Error getting chatbot agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.post("/:id/messages", async (req, res) => {
  const { message } = req.body;
  const chatId = req.params.id;

  try {
    const { success, error } = await chatMessageValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let chat = await Chat.findOne({
      where: {
        id: chatId,
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

    if (!chat) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid chat id." });
    }

    if (chat.toJSON().connectedUserId) {
      return res.status(400).json({
        success: false,
        message:
          "A human agent has already been connected, can't continue chat with the ai agent.",
      });
    }

    // Re-open the chat.
    if (chat.toJSON().status !== "open") {
      chat.status = "open";
      await chat.save();
    }

    chat = chat.toJSON();

    const count = await BusinessIntegration.count({
      where: {
        businessId: chat.businessId,
        integrationId: {
          [Op.in]: [CALENDLY_INTEGRATION_ID, GOOGLE_CALENDAR_INTEGRATION_ID],
        },
      },
    });

    let canScheduleMeeting = count !== 2 ? false : true;

    let customerDetails = await redisClient.lIndex(`chat-${chat.id}`, 0);

    if (customerDetails) {
      customerDetails = JSON.parse(customerDetails);

      if (customerDetails?.type !== "pre-chat-form") {
        customerDetails = "";
      } else {
        customerDetails = customerDetails.content;
      }
    }

    const humanMessage = {
      id: uuidv4(),
      type: "human",
      senderId: null,
      content: message,
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(humanMessage));

    const response = await generateChatbotAgentResponse(
      message,
      chat.businessId,
      chat.business.name,
      chat.business.assistant.name,
      chat.business.assistant.knowledgeBaseName,
      customerDetails,
      chat.id,
      canScheduleMeeting
    );

    const aiMessage = {
      id: uuidv4(),
      type: "ai",
      content: response.content,
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(aiMessage));

    chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      include: [
        {
          model: User,
          as: "connectedUser",
          attributes: ["id", "name", "profileImageUrl"],
        },
        {
          model: User,
          attributes: ["id", "name", "profileImageUrl"],
          as: "users",
          through: {
            // attributes: [],
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
    });

    chat = chat.toJSON();

    res.status(200).json({
      success: true,
      data: {
        humanMessage,
        aiMessage,
      },
    });

    if (response?.name === "HumanConnector" && chat.connectedUser) {
      // Trigger chat transfer notification to the human agent.

      const statusUpdateMessage = {
        id: uuidv4(),
        type: "chat-transferred",
        content: {
          connectedUserId: chat.connectedUser.id,
          connectedUserName: chat.connectedUser.name,
        },
        timestamp: new Date().getTime(),
      };

      await redisClient.rPush(
        `chat-${chatId}`,
        JSON.stringify(statusUpdateMessage)
      );

      let messages = await redisClient.lRange(`chat-${chatId}`, 0, -1);

      const io = getSocketIOInstance();
      io.to(`${chat.connectedUser.id}`).emit("chat:incoming-chat", {
        chat: {
          ...chat,
          lastMessage: statusUpdateMessage,
        },
        messages,
      });

      // Notify the customer that a human agent has joined the chat.

      setTimeout(() => {
        io.to(`chat-${chat.id}`).emit("chat:update-status", {
          chatId: chat.id,
          statusUpdateMessage,
          connectedUser: chat.connectedUser,
        });
      }, 1000);
    }
  } catch (error) {
    console.error("Error getting chatbot agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    let chat = await Chat.findOne({
      where: { id: req.params.id },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ success: true, message: "Invalid chat id." });
    }

    chat = chat.toJSON();

    let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);
    messages = messages.map((item) => JSON.parse(item));

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("Error getting chat messages: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    let chat = await Chat.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: User,
          as: "connectedUser",
          attributes: ["id", "name", "profileImageUrl"],
        },
      ],
    });

    if (!chat) {
      return res
        .status(404)
        .json({ success: true, message: "Invalid chat id." });
    }

    chat = chat.toJSON();

    let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);
    messages = messages.map((item) => JSON.parse(item));

    res.status(200).json({ success: true, data: { chat, messages } });
  } catch (error) {
    console.error("Error getting chat messages: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  const chatId = req.params.id;

  try {
    const { success, error } = await chatValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let { status, teamGroupIds } = req.body;

    let chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      include: [
        {
          model: User,
          as: "connectedUser",
        },
      ],
    });

    if (!chat) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid chat id." });
    }

    chat = chat.toJSON();

    let statusUpdateMessage;
    if (chat.status === "open" && status === "closed") {
      statusUpdateMessage = {
        id: uuidv4(),
        type: "chat-closed",
        content: {
          connectedUserId: chat?.connectedUser?.id,
          connectedUserName: chat?.connectedUser?.name,
        },
        timestamp: new Date().getTime(),
      };

      await redisClient.rPush(
        `chat-${chatId}`,
        JSON.stringify(statusUpdateMessage)
      );

      // Notify the customer that human agent has closed the chat..
      const io = getSocketIOInstance();

      io.to(`chat-${chat.id}`).emit("chat:update-status", {
        chatId: chat.id,
        statusUpdateMessage,
        connectedUser: null,
      });
    }

    await Chat.update(
      {
        status,
        connectedUserId:
          status === "closed" || status === "archived"
            ? null
            : chat.connectedUserId,
      },
      {
        where: {
          id: chatId,
        },
      }
    );

    if (teamGroupIds?.length === 0) {
      await ChatGroupAssignment.destroy({
        where: {
          chatId,
        },
      });
    } else if (teamGroupIds?.length > 0) {
      await ChatGroupAssignment.destroy({
        where: {
          chatId,
          teamGroupId: {
            [Op.notIn]: teamGroupIds,
          },
        },
      });

      let currentlyAssignedGroups = await ChatGroupAssignment.findAll({
        where: {
          chatId,
          teamGroupId: {
            [Op.in]: teamGroupIds,
          },
        },
      });

      const currentlyAssignedGroupIds = currentlyAssignedGroups.map(
        (item) => item.toJSON().teamGroupId
      );

      const newlyAssignedGroupIds = teamGroupIds.filter(
        (id) => !currentlyAssignedGroupIds.includes(id)
      );

      await ChatGroupAssignment.bulkCreate(
        newlyAssignedGroupIds.map((teamGroupId) => ({ chatId, teamGroupId }))
      );
    }

    chat = await Chat.findOne({
      where: {
        id: chatId,
      },
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
    });

    chat = chat?.toJSON();

    res
      .status(200)
      .json({ success: true, data: { chat, statusUpdateMessage } });
  } catch (error) {
    console.error("Error getting chatbot agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.post("/:id/upload", upload.array("files"), async (req, res) => {
  const { userId } = req.body;

  console.log("req.files - ", req.files);

  if (!req.files || req.files.length < 1) {
    return res.status(400).json({
      success: false,
      message: "Please provide one or more files to upload.",
    });
  }

  const chatId = req.params.id;

  try {
    let chat = await Chat.findOne({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat id.",
      });
    }

    chat = chat.toJSON();

    let user;

    if (userId) {
      user = await User.findOne({
        where: {
          id: userId,
        },
        attributes: ["profileImageUrl"],
      });

      user = user?.toJSON();
    }

    const messages = await Promise.all(
      req.files.map(async (file) => {
        const resourceUrl = `${CHAT_UPLOADS_BASE_URL}/${file.filename}`;

        const resourceType = file.mimetype?.startsWith("image/")
          ? "image"
          : "document";

        const message = {
          id: uuidv4(),
          type: resourceType,
          senderId: userId || null,
          senderProfileImageUrl: user ? user.profileImageUrl : null,
          receiverId: userId ? null : chat.connectedUserId,
          status: "Delivered",
          content: {
            url: resourceUrl,
            name: file.originalname,
            size: file.size,
          },
          timestamp: new Date().getTime(),
        };

        await redisClient.rPush(`chat-${chatId}`, JSON.stringify(message));
        return message;
      })
    );

    res.status(200).json({ success: true, data: messages });

    const io = getSocketIOInstance();

    let receiverId;

    if (userId) receiverId = `chat-${chatId}`;
    else receiverId = `${chat.connectedUserId}`;

    io.to(receiverId).emit("chat:new-message", { chatId, messages });
  } catch (error) {
    console.error("Error uploading files: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const chatId = req.params.id;

  try {
    let chat = await Chat.findOne({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat id.",
      });
    }

    chat = chat.toJSON();

    if (chat.status === "open") {
      return res.status(400).json({
        success: false,
        message: "Open chats cannot be deleted.",
      });
    }

    await Chat.destroy({
      where: { id: chatId },
    });

    await redisClient.del(`chat-${chatId}`);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting chat: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
