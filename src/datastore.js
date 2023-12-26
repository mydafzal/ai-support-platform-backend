let conversations = [];

function addConversation(userId, conversation) {
  conversations.push({ userId, conversation });
}

function getConversationByUserId(userId) {
  return conversations.find((item) => item.userId === userId)?.conversation;
}

function updateConversation(userId, conversation) {
  const index = conversations.findIndex((item) => item.userId === userId);
  if (conversation?.[index]?.conversation) {
    conversations[index].conversation = conversation;
  }
}

function deleteConversation(userId) {
  conversations = conversations.filter((item) => item.userId !== userId);
}

module.exports = {
  addConversation,
  getConversationByUserId,
  updateConversation,
  deleteConversation,
};
