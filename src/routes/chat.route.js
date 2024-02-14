const router = require("express").Router();
const Assistant = require("../models/assistant.model");

const {
  generateChatbotAgentResponse,
} = require("../controllers/chatbotAgent.controller");
const Business = require("../models/business.model");

const { z } = require("zod");
const { redisClient } = require("../integrations/redis");
const { generateChatTitle } = require("../utils/helpers");
const Chat = require("../models/chat.model");

const chatValidationSchema = z.object({
  message: z.string(),
  userId: z.number(),
  chatId: z.number().optional(),
  mode: z.enum(["specific", "general"]),
  messageId: z.number().optional(),
});

router.post("/", async (req, res) => {
  const { message, userId, messageId, mode } = req.body;
  let { chatId } = req.body;

  try {
    const { success, error } = await chatValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const chatLength = await redisClient.LLEN(`chat-${chatId}`);
    let chatTitle;

    if (chatLength === 0) {
      chatTitle = await generateChatTitle(message);

      let chat = await Chat.create({
        title: chatTitle,
        userId,
      });

      chat = chat.toJSON();
      chatId = chat.id;
    }

    console.log("chatlength", chatLength);

    let assistant = await Assistant.findOne({
      where: {
        userId,
      },
    });

    if (!assistant) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    assistant = assistant.toJSON();

    let business = await Business.findOne({
      where: {
        userId,
      },
    });

    business = business.toJSON();

    const result = await generateChatbotAgentResponse(
      message,
      business.businessName,
      assistant.name,
      assistant.knowledgeBaseName,
      `chat-${chatId}`
    );

    const aiResponse = {
      type: "ai",
      content: result,
      timestamp: new Date().getTime(),
    };

    res.status(200).json({ success: true, data: { chatTitle, aiResponse } });
  } catch (error) {
    console.error("Error getting chatbot agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
