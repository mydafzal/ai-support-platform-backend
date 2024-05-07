const { Chat } = require("../../models");
const { redisClient } = require("../integrations/redis");
const { isValidInteger } = require("../utils/helpers");
const { v4: uuidv4 } = require("uuid");

module.exports = (io, socket) => {
  const userId = socket.request._query.userId;

  const sendMessage = async (payload, callback) => {
    const { chatId, message } = payload;

    const senderId = isValidInteger(userId) ? parseInt(userId) : null;

    let chat = await Chat.findOne({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      console.log("invalid chat id received.");
      return;
    }

    chat = chat.toJSON();

    const humanMessage = {
      id: uuidv4(),
      type: "human",
      senderId,
      recevierId: chat.connectedUserId,
      content: message,
      status: "Delivered",
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(humanMessage));

    let recevierId;

    if (senderId) {
      recevierId = `chat-${chatId}`;
    } else {
      recevierId = `${userId}`;
    }

    socket.to(recevierId).emit("chat:new-message", { message: humanMessage });

    if (typeof callback === "function") {
      callback(humanMessage);
    }

    const roomName = `team-${chat.businessId}`;
    socket.to(roomName).emit("chat:new-message", { message: humanMessage });
  };

  const handleTyping = async (payload) => {
    const { chatId, isTyping } = payload;

    const senderId = isValidInteger(userId) ? parseInt(userId) : null;

    let recevierId;

    if (senderId) {
      recevierId = `chat-${chatId}`;
    } else {
      recevierId = `${userId}`;
    }

    socket.to(recevierId).emit("chat:typing", { chatId, isTyping });

    let chat = await Chat.findOne({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      console.log("invalid chat id received.");
      return;
    }

    chat = chat.toJSON();

    const roomName = `team-${chat.businessId}`;
    socket.to(roomName).emit("chat:typing", { chatId, isTyping });
  };

  const updateMessageStatus = async (payload) => {
    const { chatId, messageIds, status } = payload;

    let messages = await redisClient.lRange(`chat-${chatId}`, 0, -1);

    for (let i = 0; i < messages.length; i++) {
      const message = JSON.parse(messages[i]);

      if (messageIds.includes(message.messageId)) {
        message.status = "Read";
        await redisClient.lSet(`chat-${chatId}`, i, JSON.stringify(message));
      }
    }

    const senderId = isValidInteger(userId) ? parseInt(userId) : null;

    let recevierId;

    if (senderId) {
      recevierId = `chat-${chatId}`;
    } else {
      recevierId = `${userId}`;
    }

    socket
      .to(recevierId)
      .emit("chat:update-message-status", { chatId, messageIds, status });
  };

  socket.on("chat:send-message", sendMessage);
  socket.on("chat:typing", handleTyping);
  socket.on("chat:update-message-status", updateMessageStatus);
};
