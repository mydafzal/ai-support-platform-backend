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

const { PDFLoader } = require("langchain/document_loaders/fs/pdf");

const { formatDocumentsAsString } = require("langchain/util/document");

const { ChatMessageHistory } = require("langchain/stores/message/in_memory");
const { RunnableWithMessageHistory } = require("@langchain/core/runnables");

const path = require("path");
const { addToVectoreStore, getVectoreStore } = require("./chroma-db");
const { ChatOpenAI } = require("@langchain/openai");

async function scrapeAndPersistData(url) {
  // "https://docs.smith.langchain.com/overview"
  // "https://cheetahagency.com/our-history/"

  const loader = new CheerioWebBaseLoader(url);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore("test-collection", docs);
}

async function readFileAndPersistData(filePath) {
  filePath = path.join(__dirname, "..", "..", "sample-file.pdf");

  const loader = new PDFLoader(filePath);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore("test-collection", docs);
}

async function splitDocuments(rawDocs) {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return await splitter.splitDocuments(rawDocs);
  } catch (error) {
    console.log("Error splitting documents", error);
  }
}

// async function initializeLangChain() {
//   const filePath = path.join(__dirname, "..", "..", "sample-file.pdf");
//   const loader = new PDFLoader(filePath);

//   const rawDocs = await loader.load();

//   const vectorstore = await MemoryVectorStore.fromDocuments(
//     docs,
//     new OpenAIEmbeddings()
//   );
//   const retriever = vectorstore.asRetriever();

//   //   const retrieverResult = await retriever.getRelevantDocuments(
//   //     // "how to upload a dataset"
//   //     "What is LangSmith?"
//   //   );
//   //   console.log(retrieverResult[0]);

//   //   const retrieverTool = createRetrieverTool(retriever, {
//   //     name: "langsmith_search",
//   //     description:
//   //       "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
//   //   });

//   const retrieverTool = createRetrieverTool(retriever, {
//     name: "ai_agent_search",
//     description:
//       "Search for information about project AI Agent. For any questions about AI Agent, you must use this tool!",
//   });

//   const tools = [retrieverTool];

//   const chatModel = new ChatOpenAI({
//     modelName: "gpt-3.5-turbo",
//     temperature: 0,
//   });

//   const systemTemplate = "You are a helpful assistant.";
//   const humanTemplate = "{input}";

//   const prompt = ChatPromptTemplate.fromMessages([
//     ["system", systemTemplate],
//     new MessagesPlaceholder("agent_scratchpad"),
//     ["human", humanTemplate],
//   ]);

//   console.log("prompt", prompt);

//   const agent = await createOpenAIFunctionsAgent({
//     llm: chatModel,
//     tools,
//     prompt,
//   });

//   const agentExecutor = new AgentExecutor({
//     agent,
//     tools,
//   });

//   console.log("executing agent now...");

//   const result1 = await agentExecutor.invoke({
//     input: "What set of technologies are to be used in the project AI Agent?",
//     // agent_scratchpad: "",
//   });

//   console.log(result1);

//   return "response";
// }

let agent;

async function initializeAgent() {
  const vectorStore = await getVectoreStore("test-collection");
  const retriever = vectorStore.asRetriever();

  const retrieverTool = createRetrieverTool(retriever, {
    name: "langsmith_search",
    description:
      "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
  });
  const tools = [retrieverTool];

  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const systemTemplate =
    "You are a helpful assistant. Answer question based on the following {context}.";
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

  console.log("prompt", prompt);

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

async function generateAgentResponse(userQuery) {
  const vectorStore = await getVectoreStore("test-collection");
  const similarityResponse = await vectorStore.similaritySearch(userQuery, 2);
  const formattedResponse = formatDocumentsAsString(similarityResponse);

  if (!agent) {
    agent = await initializeAgent();
  }

  console.log("executing agent now...");

  const response = await agent.invoke(
    {
      input: userQuery,
      context: formattedResponse,
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
  scrapeAndPersistData,
  readFileAndPersistData,
  generateAgentResponse,
};
