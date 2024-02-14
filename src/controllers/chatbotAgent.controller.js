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

const { z } = require("zod");
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

  // console.log("prompt", prompt);

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
  chatId
) {
  const agent = await initializeAgent(knowledgeBaseName);

  // const vectorStore = await getVectoreStore(knowledgeBaseName);
  // const similarityResponse = await vectorStore
  //   .asRetriever(3)
  //   .getRelevantDocuments(businessName);

  // const formattedBusinessDetails = formatDocumentsAsString(similarityResponse);

  const systemPrompt = createSystemPrompt(
    businessName,
    assistantName
    // formattedBusinessDetails
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

function createSystemPrompt(businessName, assistantName, businessInformation) {
  let prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. You are actually supposed to talk to customers of the business based on the information that the business has provided you. But in this conversation you are talking to the business itself. You are supposed to engage in insightful and engaging conversations about the business. To any answer question about business or related to the business, you must call the 'search-business-information' tool. Whenever you call this tool retrieve the information you need to answer question, you must first create a contextual query based on the business and the previous conversation and then pass this query to the tool. Don't makup answers from yourself.
  `;

  return prompt;
}

module.exports = { generateChatbotAgentResponse };
