const conversations = [];

function addConversation(userId, conversation) {
  conversations.push({ userId, conversation });
}

function getConversationByUserId(userId) {
  return conversations.find((item) => item.userId === userId)?.conversation;
}

function updateConversation(userId, conversation) {
  const index = conversations.findIndex((item) => item.userId === userId);
  conversations[index].conversation = conversation;
}

module.exports = {
  addConversation,
  getConversationByUserId,
  updateConversation,
};
