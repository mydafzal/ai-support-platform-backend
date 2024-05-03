const router = require("express").Router();
const {
  Chat,
  Business,
  Assistant,
  BusinessIntegration,
  ChatWidget,
} = require("../../models");

const {
  generateChatbotAgentResponse,
} = require("../controllers/chatbotAgent.controller");

const { z } = require("zod");
const { redisClient } = require("../integrations/redis");
const { Op } = require("sequelize");
const {
  CALENDLY_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  HUBPOST_INTEGRATION_ID,
} = require("../utils/constants");
const { formatObjectToString } = require("../utils/formatters");

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
      return res.status(400).json({ success: true, data: "Invalid request." });
    }

    chatWidget = chatWidget.toJSON();

    let chat = await Chat.create({
      title: name,
      businessId,
      teamGroupId,
    });

    chat = chat.toJSON();

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

    if (teamGroupId) {
      await Chat.update(
        {
          teamGroupId,
        },
        {
          where: {
            id: chatId,
          },
        }
      );
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

    chat = chat.toJSON();

    const count = await BusinessIntegration.count({
      where: {
        businessId: chat.businessId,
        integrationId: {
          [Op.in]: [
            CALENDLY_INTEGRATION_ID,
            GOOGLE_CALENDAR_INTEGRATION_ID,
            HUBPOST_INTEGRATION_ID,
          ],
        },
      },
    });

    // Businesses must connect both Google Calendar and Calendly integrations so that customers can schedule meetings.
    let canScheduleMeeting = count !== 3 ? false : true;

    let customerDetails = await redisClient.lIndex(`chat-${chat.id}`, 0);

    if (customerDetails) {
      customerDetails = JSON.parse(customerDetails);

      if (customerDetails?.type === "pre-chat-form") {
        customerDetails = formatObjectToString(customerDetails?.data?.content);
      } else {
        customerDetails = "";
      }
    }

    const humanMessage = {
      type: "human",
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
      type: "ai",
      content: response,
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(aiMessage));

    res.status(200).json({ success: true, data: aiMessage });
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
        .status(400)
        .json({ success: true, message: "Invalid chat id." });
    }

    let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);
    messages = messages.map((item) => JSON.parse(item));

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("Error getting chat messages: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
