const { redisClient } = require("../integrations/redis");

const {
  Business,
  Assistant,
  ChatWidget,
  ChatGroupAssignment,
  User,
  BusinessIntegration,
  ChatUserAssignment,
  Chat,
  Group,
} = require("../../models");

const {
  generateChatbotAgentResponse,
} = require("../controllers/chatbotAgent.controller");

const { Op } = require("sequelize");

const { v4: uuidv4 } = require("uuid");

const { getSocketIOInstance } = require("../loaders/socket-io");

const {
  CHAT_UPLOADS_BASE_URL,
  CALENDLY_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  CHATS_FEATURE_ID,
} = require("../utils/constants");

const SubscriptionService = require("../services/subscription.service");

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
  });

  chats = chats.map((item) => item.toJSON());

  return await Promise.all(
    chats.map(async (chat) => {
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

async function deleteChatsByBusiness(data) {
  const { businessId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  await Chat.destroy({
    where: {
      businessId,
    },
  });
}

async function createChat(data) {
  const { name, email, phone, groupId, groupName, businessId } = data;

  let chatWidget = await ChatWidget.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  if (!chatWidget) {
    throw {
      statusCo: 400,
      message: "Invalid request. Please create a chat widget first.",
    };
  }

  let chat = await Chat.create({
    title: name,
    businessId,
  });

  chat = chat.toJSON();

  if (groupId && groupName) {
    await ChatGroupAssignment.create({
      chatId: chat.id,
      groupId,
    });
  }

  const preChatForm = {
    type: "pre-chat-form",
    content: {
      name,
      email,
      phone,
      groupId,
      groupName,
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

  await SubscriptionService.updateFeatureUsage(CHATS_FEATURE_ID, businessId, 1);

  return {
    chatId: chat.id,
    messages: [preChatForm, welcomeMessage],
  };
}

async function updatePreChatForm(data) {
  const { chatId, name, email, phone, groupId, groupName, businessId } = data;

  let chatWidget = await ChatWidget.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  if (!chatWidget) {
    throw { statusCode: 400, message: "Invalid chat widget id." };
  }

  if (groupId && groupName) {
    // First, check if the customer again selected the same group.
    let chatGroupAssignment = await ChatGroupAssignment.findOne({
      where: {
        chatId,
        groupId,
      },
      raw: true,
    });

    // If no, then this time the customer's queries belong to a different group (department)
    if (!chatGroupAssignment) {
      await ChatGroupAssignment.create({
        chatId,
        groupId,
      });
    }
  }

  const preChatForm = {
    type: "pre-chat-form",
    content: {
      email,
      name,
      phone,
      groupId,
      groupName,
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

  return [preChatForm, welcomeMessage];
}

async function getMessagesByChat(data) {
  const { chatId } = data;

  let chat = await Chat.findOne({
    where: { id: chatId },
    raw: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

  let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);
  return messages.map((item) => JSON.parse(item));
}

async function getChatById(data) {
  const { chatId } = data;

  let chat = await Chat.findOne({
    where: { id: chatId },
    include: [
      {
        model: User,
        as: "connectedUser",
        attributes: ["id", "name", "profileImageUrl"],
      },
    ],
    raw: true,
    nest: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

  let messages = await redisClient.lRange(`chat-${chat.id}`, 0, -1);
  messages = messages.map((item) => JSON.parse(item));

  return { chat, messages };
}

async function uploadFilesInChat(data) {
  const { chatId, userId, files } = data;

  let chat = await Chat.findOne({
    where: {
      id: chatId,
    },
    raw: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

  let user;

  if (userId) {
    user = await User.findOne({
      where: {
        id: userId,
      },
      attributes: ["profileImageUrl"],
      raw: true,
    });
  }

  const messages = await Promise.all(
    files.map(async (file) => {
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

  return { chat, messages };
}

async function deleteChat(data) {
  const { chatId } = data;

  let chat = await Chat.findOne({
    where: {
      id: chatId,
    },
    raw: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

  if (chat.status === "open") {
    throw { statusCode: 404, message: "Open chats cannot be deleted." };
  }

  await Chat.destroy({
    where: { id: chatId },
  });

  await redisClient.del(`chat-${chatId}`);
}

async function updateChat(data) {
  let { chatId, status, groupIds } = data;

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
    raw: true,
    nest: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

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

  if (groupIds?.length === 0) {
    await ChatGroupAssignment.destroy({
      where: {
        chatId,
      },
    });
  } else if (groupIds?.length > 0) {
    await ChatGroupAssignment.destroy({
      where: {
        chatId,
        groupId: {
          [Op.notIn]: groupIds,
        },
      },
    });

    let currentlyAssignedGroups = await ChatGroupAssignment.findAll({
      where: {
        chatId,
        groupId: {
          [Op.in]: groupIds,
        },
      },
    });

    const currentlyAssignedGroupIds = currentlyAssignedGroups.map(
      (item) => item.toJSON().groupId
    );

    const newlyAssignedGroupIds = groupIds.filter(
      (id) => !currentlyAssignedGroupIds.includes(id)
    );

    await ChatGroupAssignment.bulkCreate(
      newlyAssignedGroupIds.map((groupId) => ({ chatId, groupId }))
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
        model: Group,
        attributes: ["id", "name"],
        as: "groups",
        through: {
          attributes: [],
        },
      },
    ],
    raw: true,
    nest: true,
  });

  return { chat, statusUpdateMessage };
}

async function sendMessage(data) {
  const { message, chatId } = data;

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
    raw: true,
    nest: true,
  });

  if (!chat) {
    throw { statusCode: 404, message: "Invalid chat id." };
  }

  if (chat.connectedUserId) {
    throw {
      statusCode: 400,
      message:
        "A human agent has already been connected, can't continue chat with the ai agent.",
    };
  }

  // Re-open the chat.
  if (chat.status !== "open") {
    chat.status = "open";

    await Chat.update(
      {
        status: "open",
      },
      {
        where: {
          id: chatId,
        },
      }
    );
  }

  const count = await BusinessIntegration.count({
    where: {
      businessId: chat.businessId,
      integrationId: {
        [Op.in]: [CALENDLY_INTEGRATION_ID, GOOGLE_CALENDAR_INTEGRATION_ID],
      },
    },
  });

  let canScheduleMeeting =
    count === 2 && !chat.business.leadMode ? true : false;

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
    chat.business,
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
  });

  chat = chat.toJSON();

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
    }, 1500);
  }

  return {
    humanMessage,
    aiMessage,
  };
}

const ChatService = {
  createChat,
  getUnviewedChatsCount,
  getChatsByBusiness,
  deleteChatsByBusiness,
  updatePreChatForm,
  getMessagesByChat,
  getChatById,
  uploadFilesInChat,
  deleteChat,
  updateChat,
  sendMessage,
};
module.exports = ChatService;
