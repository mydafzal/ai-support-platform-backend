const { createRetrieverTool } = require("langchain/tools/retriever");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} = require("@langchain/core/prompts");

const {
  createOpenAIFunctionsAgent,
  AgentExecutor,
} = require("langchain/agents");

const { RunnableWithMessageHistory } = require("@langchain/core/runnables");

const { getVectoreStore } = require("../integrations/chromaDB");
const { ChatOpenAI } = require("@langchain/openai");
const { formatDocumentsAsString } = require("langchain/util/document");

const { ExtendedRedisChatMemory } = require("../utils/helpers");
const { redisClient } = require("../integrations/redis");

async function initializeAgent(knowledgeBaseName) {
  const vectorStore = await getVectoreStore(knowledgeBaseName);
  const retriever = vectorStore.asRetriever();

  const informationRetrieverTool = createRetrieverTool(retriever, {
    name: "search-business-information",
    description:
      "Search for any information about the business. For any questions about the business, you must use this tool!",
  });

  const tools = [informationRetrieverTool];

  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const systemTemplate = `{systemPrompt}`;

  const systemPromptTemplate =
    SystemMessagePromptTemplate.fromTemplate(systemTemplate);

  const humanTemplate = "{input}";
  const humanPromptTemplate =
    HumanMessagePromptTemplate.fromTemplate(humanTemplate);

  const prompt = ChatPromptTemplate.fromMessages([
    systemPromptTemplate,
    new MessagesPlaceholder("chat_history"),
    new MessagesPlaceholder("agent_scratchpad"),
    humanPromptTemplate,
  ]);

  const agent = await createOpenAIFunctionsAgent({
    llm: chatModel,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const agentWithChatHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: (sessionId) =>
      new ExtendedRedisChatMemory({
        sessionId,
        client: redisClient,
      }),
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  });

  return agentWithChatHistory;
}

async function generateChatbotAgentResponse(
  userQuery,
  businessName,
  assistantName,
  knowledgeBaseName,
  chatId,
  chatMode
) {
  const agent = await initializeAgent(knowledgeBaseName);

  const vectorStore = await getVectoreStore(knowledgeBaseName);
  const similarityResponse = await vectorStore
    .asRetriever(3)
    .getRelevantDocuments(businessName);

  const formattedBusinessDetails = formatDocumentsAsString(similarityResponse);
  console.log("formattedBusinessDetails", formattedBusinessDetails);

  // return formattedBusinessDetails;

  const systemPrompt = createSystemPrompt(
    businessName,
    assistantName,
    chatMode,
    formattedBusinessDetails
  );

  console.log("executing agent now...");

  const response = await agent.invoke(
    {
      input: userQuery,
      systemPrompt,
    },
    {
      configurable: {
        sessionId: chatId,
      },
    }
  );

  return response.output;
}

function createSystemPrompt(
  businessName,
  assistantName,
  chatMode,
  businessDetails
) {
  let prompt;

  if (chatMode === "specific") {
    console.log("chat mode ------", chatMode);

    //   prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. You are actually supposed to talk to customers of the business based on the information that the business has provided you. But in this conversation you are talking to the business itself. You are supposed to engage in insightful and engaging conversations about the business. To any answer question about business or related to the business, you must call the 'search-business-information' tool. Whenever you call this tool retrieve the information you need to answer question, you must first create a contextual query based on the business and the previous conversation and then pass this query to the tool. Don't makup answers from yourself.
    // `;

    // prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. Your primary function is to engage with customers based solely on the information provided by the business. However, in this conversation, you are communicating directly with the business itself. When responding to inquiries about the business or related topics, you must utilize the 'search-business-information' tool to retrieve relevant data. Ensure that each query to the tool is contextual, incorporating information from the business and the ongoing conversation. Avoid providing answers based on personal judgment, outside knowledge. Remember, you are NOT supposed to engage in conversations on general topics that are not specifically related to the business ${businessName}.  Your role is to facilitate insightful and accurate discussions about the business.`;

    prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. Your purpose is to engage exclusively in discussions related to the business and its operations. When communicating with the business, refrain from discussing general topics or providing information outside the scope of the business's domain. If asked about non-business-related matters, politely inform the user that your function is restricted to discussing only business-related topics. Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities. If the information returned from 'search-business-information' tool does not make sense and is not related to the business, don't answer the question.
    
    
    Here is some information about the business to help you figure out whether a user question is related to the business or not:
    ${businessDetails}
    
    `;
  } else {
    prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. In this conversation, you're engaging with the business in a more generalized manner, drawing upon both the specific data provided by the business and your broader knowledge base. You can provide insights, recommendations, and information beyond the scope of the business's training data.
  
    Your goal is to foster informative and thought-provoking discussions with the business. While you can still utilize the 'search-business-information' tool when necessary, you're also empowered to draw upon your general knowledge to enrich the conversation.
    
    Remember to adapt your responses based on the context of the conversation and the needs of the business. Your role is to be a knowledgeable and resourceful partner in dialogue, capable of providing valuable insights and assistance beyond the confines of the business's specific data.
    
    
    Here is some information about the business to help you figure out whether a user question is related to the business or not:
    ${businessDetails}
    `;
  }

  return prompt;
}

module.exports = { generateChatbotAgentResponse };
