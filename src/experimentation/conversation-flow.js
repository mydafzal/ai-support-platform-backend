const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  CheerioWebBaseLoader,
} = require("langchain/document_loaders/web/cheerio");

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

const { z } = require("zod");

const { PDFLoader } = require("langchain/document_loaders/fs/pdf");

const { formatDocumentsAsString } = require("langchain/util/document");

const { ChatMessageHistory } = require("langchain/stores/message/in_memory");
const { RunnableWithMessageHistory } = require("@langchain/core/runnables");

const path = require("path");
const { getVectoreStore } = require("./chroma-db");
const { ChatOpenAI } = require("@langchain/openai");

const { DynamicStructuredTool } = require("@langchain/community/tools/dynamic");

let agent;

async function initializeAgent() {
  const vectorStore = await getVectoreStore("test-collection");
  const retriever = vectorStore.asRetriever();

  const conversationFlowRetrieverTool = new DynamicStructuredTool({
    name: "get-instructions-for-conversation",
    description:
      "Call this when user poses a specific question that you don't know how to respond to, or when user describes a specific problem or asks you to do a specific task.",
    schema: z.object({
      userInput: z
        .string()
        .describe(
          "Input that is received from the user. This might a question, a problem regarding specific topic or a a task."
        ),
    }),
    func: async ({ userInput }) => {
      console.log("user's input for conversation flow.", userInput);

      const vectorStore = await getVectoreStore("conversation-flows");
      const retriever = vectorStore.asRetriever();

      const relevantDocs = await retriever.getRelevantDocuments(userInput);

      //   const relevantDocs[0].metadata.id;

      console.log("relevant docs", relevantDocs);

      return relevantDocs[0].pageContent;

      return `
        User: Can you help me find a laptop?
        AI: Hello! I'd be happy to help you find the perfect laptop. To get started, could you please tell me a bit more about your preferences?
        
        User: I need a laptop for gaming.
        AI: Great choice! Gaming laptops have unique features. What's your preferred budget range, and are there any specific brands you're interested in?

        User: "Customer specifies a budget and mentions a preferred brand."
        AI: Awesome! Given your budget and preference for [Brand], I recommend considering the [Model A] or [Model B]. These both offer excellent performance for gaming.

        User: "Customer asks for more information about [Model A]."
        AI: Certainly! [Model A] features [specifications], and customers have praised its performance for gaming. Additionally, we currently have a promotion that includes [details].
        
        User: "Customer expresses interest in purchasing [Model A]."
        AI: Fantastic choice! I can help you with the order. Would you like to proceed with the purchase, or do you have any other questions?
      `;
    },
  });

  const productsRetrieverTool = new DynamicStructuredTool({
    name: "get-available-products",
    description:
      "Call this when user provide some details about the product and you have to present user with the available products.",
    schema: z.object({
      category: z
        .string()
        .describe(
          "Product category based on the information provided by the user e.g laptop, phone etc."
        ),
      budget: z
        .string()
        .describe("Budget for the product that the user wants to purchase."),
      brand: z.string().describe("User's preferred brand for the product."),
    }),
    func: ({ category, budget, brand }) => {
      console.log("user's input for the product", category, budget, brand);
      return ["Dell XPS 13 and XPS 15", "HP Spectre x360"].toString();
    },
  });

  const tools = [conversationFlowRetrieverTool, productsRetrieverTool];

  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const systemTemplate = `You are an AI-powered assistant designed to help users navigate given conversation flow. Users may ask questions related to various topics, and your goal is to provide informative and contextually relevant responses based on the given conversation flow. Please ensure that your answers align with the predefined scenarios and maintain a conversational tone. If necessary, ask clarifying questions to better understand user queries. Always aim to assist users effectively and steer the conversation according to the given flow.
  `;

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

  //   console.log("prompt", prompt);

  const agent = await createOpenAIFunctionsAgent({
    llm: chatModel,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const messageHistory = new ChatMessageHistory();

  const agentWithChatHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: (_sessionId) => messageHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  });

  return agentWithChatHistory;
}

async function generateConversationFlowAgentResponse(userQuery) {
  if (!agent) {
    agent = await initializeAgent();
  }

  console.log("executing agent now...");

  const response = await agent.invoke(
    {
      input: userQuery,
    },
    {
      configurable: {
        sessionId: "foo",
      },
    }
  );

  return response.output;
}

module.exports = {
  generateConversationFlowAgentResponse,
};
