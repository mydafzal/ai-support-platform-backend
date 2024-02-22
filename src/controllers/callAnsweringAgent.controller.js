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
const { DynamicStructuredTool } = require("@langchain/community/tools/dynamic");

const { z } = require("zod");

const { ExtendedRedisChatMemory } = require("../utils/helpers");
const { redisClient } = require("../integrations/redis");

async function initializeAgent(collectionName) {
  const vectorStore = await getVectoreStore(collectionName);
  const retriever = vectorStore.asRetriever();

  const meetingSchedulerTool = new DynamicStructuredTool({
    name: "meeting-scheduler",
    description: "Call this to schedule a customer's meeting.",
    schema: z.object({
      email: z.string().describe("Customer's email."),
    }),
    func: ({ email }) => {
      console.log("new info", email);
      return "";
    },
  });

  const informationRetrieverTool = createRetrieverTool(retriever, {
    name: "search-business-information",
    description:
      "Search for any information about the business. For any questions about the business, you must use this tool!",
  });

  const tools = [informationRetrieverTool, meetingSchedulerTool];

  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const systemTemplate = `{systemPrompt}`;

  const systemPromptTemplate =
    SystemMessagePromptTemplate.fromTemplate(systemTemplate);

  //   const systemPromptTemplate = await SystemMessagePromptTemplate.fromTemplate(
  //     systemTemplate
  //   ).format({
  //     context: formattedResponse,
  //   });

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

async function generateCallAnsweringAgentResponse(
  userQuery,
  businessName,
  customerName,
  assistantName,
  customerDetails,
  callId,
  collectionName
) {
  //   const vectorStore = await getVectoreStore("test-collection");
  //   const similarityResponse = await vectorStore.similaritySearch(userQuery, 2);
  //   const formattedResponse = formatDocumentsAsString(similarityResponse);

  // if (!agent) {
  //   agent = await initializeAgent();
  // }

  const agent = await initializeAgent(collectionName);

  const systemPrompt = createSystemPrompt(
    businessName,
    assistantName,
    customerName,
    customerDetails,
    collectionName
  );

  console.log("executing agent now...");

  const response = await agent.invoke(
    {
      input: userQuery,
      //   context: formattedResponse,
      systemPrompt,
    },
    {
      configurable: {
        sessionId: `transcription-${callId}`,
      },
    }
  );

  return response.output;
}

function createSystemPrompt(
  businessName,
  assistantName,
  customerName,
  customerDetails
) {
  let prompt;
  let isNewCustomer = customerName ? false : true;

  if (!isNewCustomer) {
    prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. You are talking to ${customerName}, a valued customer on a phone call. You will help ${businessName}'s potential and current customers learn more about the business, connect customers to human agents of the business, and schedule customers' meetings with the team. Remember to maintain a friendly and professional tone throughout the conversation. Mostly importantly, provide EXTREMELY CONCISE responses because you are a phone call. Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities. If the information returned from 'search-business-information' tool does not make sense and is not related to the business, don't answer the question.

    Here is the customer's information:
    ${customerDetails}
    
    When you call 'search-business-informaton' tool, make sure to pass a contextual query based on information you have about the business and the previous conversation history .
    `;
  } else {
    prompt = `You are ${businessName}'s AI Assistant, ${assistantName}. You are engaging with a new customer who is eager to learn more about ${businessName}. Your goal is to provide an overview of the business, answer any initial questions, and guide the customer on how to connect with human agents for more personalized assistance. Utilize the information available to create an informative and welcoming introduction. Remember to maintain a friendly and professional tone throughout the conversation. Additionally, focus on capturing the customer's interest and encouraging further exploration of ${businessName}'s offerings. Mostly importantly, provide EXTREMELY CONCISE responses because you are a phone call. Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities. If the information returned from 'search-business-information' tool does not make sense and is not related to the business, don't answer the question.

    When you call 'search-business-informaton' tool, make sure to pass a contextual query based on information you have about the business and the previous conversation history .
    `;
  }

  return prompt;
}

module.exports = { generateCallAnsweringAgentResponse };
