const router = require("express").Router();
const Assistant = require("../../models");

const {
  generateChatbotAgentResponse,
} = require("../controllers/chatbotAgent.controller");
const Business = require("../../models");

const { z } = require("zod");
const { redisClient } = require("../integrations/redis");
const { generateChatTitle } = require("../utils/helpers");
const Chat = require("../../models");

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

    // Edit message
    else if (messageId) {
      await redisClient.lTrim(`chat-${chatId}`, messageId - 1, -1); // Remove messages onward the message to be edited.
    }

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
      `chat-${chatId}`,
      mode
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

router.delete("/:id", async (req, res) => {
  try {
    await Chat.destroy({
      where: { id: req.params.id },
    });

    await redisClient.del(`chat-${req.params.id}`);

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
