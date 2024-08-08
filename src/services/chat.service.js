const { ChatUserAssignment, Chat, Group, User } = require("../../models");
const { redisClient } = require("../integrations/redis");

async function getUnviewedChatsCount(data) {
  const { viewed, userId } = data;

  return await ChatUserAssignment.count({
    where: {
      userId,
      viewed,
    },
  });
}

async function getChatsByBusiness(data) {
  const { businessId } = data;

  let chats = await Chat.findAll({
    where: { businessId },
    include: [
      {
        model: User,
        attributes: ["id", "name", "profileImageUrl"],
        as: "users",
        through: {},
      },
      {
        model: Group,
        attributes: ["id", "name"],
        as: "groups",
        through: {
          attributes: [],
        },
      },
    ],
    order: [["createdAt", "DESC"]],
    raw: true,
    nest: true,
  });

  return await Promise.all(
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
}

const ChatService = { getUnviewedChatsCount, getChatsByBusiness };
module.exports = ChatService;
