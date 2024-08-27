const { Chat, User } = require("../../models");
const { redisClient } = require("../integrations/redis");
const { isValidInteger } = require("../utils/helpers");
const { v4: uuidv4 } = require("uuid");

module.exports = (io, socket) => {
  const userId = socket.request._query.userId;

  const sendMessage = async (payload, callback) => {
    const { chatId, message } = payload;

    const chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      raw: true,
    });

    if (!chat) {
      console.log("invalid chat id received.");
      return;
    }

    const sender = isValidInteger(userId) ? "agent" : "customer";

    let user;

    if (sender === "agent") {
      user = await User.findOne({
        where: {
          id: userId,
        },
        attributes: ["profileImageUrl"],
        raw: true,
      });
    }

    const humanMessage = {
      id: uuidv4(),
      type: "human",
      senderId: sender === "agent" ? userId : "",
      senderProfileImageUrl: user ? user.profileImageUrl : null,
      receiverId: sender === "agent" ? null : chat.connectedUserId,
      content: message,
      status: "Delivered",
      timestamp: new Date().getTime(),
    };

    await redisClient.rPush(`chat-${chatId}`, JSON.stringify(humanMessage));

    let receiverId;
    if (sender === "agent") receiverId = `chat-${chatId}`;
    else receiverId = `${chat.connectedUserId}`;

    socket
      .to(receiverId)
      .emit("chat:new-message", { chatId, message: humanMessage });

    if (typeof callback === "function") {
      callback(humanMessage);
    }

    const roomName = `team-${chat.businessId}`;
    socket
      .to(roomName)
      .emit("chat:new-message", { chatId, message: humanMessage });
  };

  const handleTyping = async (payload) => {
    const { chatId, isTyping } = payload;

    const chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      raw: true,
    });

    if (!chat) {
      console.log("invalid chat id received.");
      return;
    }

    const sender = isValidInteger(userId) ? "agent" : "customer";

    let receiverId;

    if (sender === "agent") receiverId = `chat-${chatId}`;
    else receiverId = `${chat.connectedUserId}`;

    socket.to(receiverId).emit("chat:typing", { chatId, isTyping });

    const roomName = `team-${chat.businessId}`;
    socket.to(roomName).emit("chat:typing", { chatId, isTyping });
  };

  const updateMessageStatus = async (payload) => {
    const { chatId, messageId, status } = payload;

    let messages = await redisClient.lRange(`chat-${chatId}`, 0, -1);

    let message;

    for (let i = 0; i < messages.length; i++) {
      message = JSON.parse(messages[i]);

      if (messageId === message.id) {
        message.status = "Read";
        await redisClient.lSet(`chat-${chatId}`, i, JSON.stringify(message));

        break;
      } else {
        message = null;
      }
    }

    if (!message) {
      return;
    }

    const senderId = message.senderId;

    let receiverId;

    if (isValidInteger(userId)) {
      receiverId = `chat-${chatId}`;
    } else {
      receiverId = `${senderId}`;
    }

    socket
      .to(receiverId)
      .emit("chat:update-message-status", { chatId, messageId, status });
  };

  socket.on("chat:send-message", sendMessage);
  socket.on("chat:typing", handleTyping);
  socket.on("chat:update-message-status", updateMessageStatus);
};
