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

const { RunnableWithMessageHistory } = require("@langchain/core/runnables");
const { ChatOpenAI } = require("@langchain/openai");
const { DynamicStructuredTool } = require("@langchain/community/tools/dynamic");
const { addTextToVectoreStore } = require("../integrations/chromaDB");

const {
  RedisChatMessageHistory,
} = require("@langchain/community/stores/message/redis");

const { createClient } = require("redis");
const redisClient = createClient();

let agent;

async function initializeAgent() {
  const informationSaverTool = new DynamicStructuredTool({
    name: "information-saver",
    description:
      "Anytime you learn some new information, you must call this tool to save that information.",
    schema: z.object({
      newInformation: z
        .string()
        .describe("Some new information about the business."),
      collectionName: z
        .string()
        .describe(
          "Name of the collection in which to store the new information."
        ),
    }),
    func: async ({ newInformation, collectionName }) => {
      console.log("new info", newInformation);
      console.log("collectionName", collectionName);

      await addTextToVectoreStore(newInformation, collectionName);
      return "";
    },
  });

  const tools = [informationSaverTool];

  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const systemTemplate = `You are an AI designed to learn about businesses through conversation. Your goal is to understand and reason about the information provided by the business. Continuously ask dynamic and insightful questions to gather more details, seek clarification, and make sense of the given information. Adapt your responses based on the context of the conversation. Your role is to simulate a learning process, so be inquisitive, thoughtful, and engaging. If the business introduces new concepts, adapt your questions to explore those areas. Always strive to deepen your understanding and maintain a conversational flow. 
  
  You must continuously keep calling the 'information-saver' tool to save any new meaningful information about the business or anything related to the business. Here is the value of 'collectionName' you will need to pass to the 'information-saver' tool: {collectionName}
  
  Here are a few examples demonstrating how the conversation will be happening:
  
    User: Hello! I'm representing ABC Innovations. We're a technology company focused on developing cutting-edge solutions.
    AI: That's intriguing! Could you share more about the specific areas of technology your company specializes in?

    User: Absolutely! We specialize in artificial intelligence, cybersecurity, and IoT solutions.
    AI: Impressive areas! Within AI, do you have a particular focus, such as natural language processing or computer vision?

    User: Our AI team primarily focuses on computer vision applications for various industries.
    AI: Computer vision is fascinating! Can you provide details on any recent projects or applications your team has worked on using computer vision technology?

    User: Certainly! We recently developed a computer vision system for quality control in manufacturing processes.
    AI: Quality control is crucial! How has the implementation of the computer vision system impacted the efficiency and accuracy of the manufacturing processes?

    User: The system significantly improved defect detection rates and reduced errors in the production line.
    AI: That's a tangible impact! Moving on, can you tell me more about your team's expertise in cybersecurity?

    User: Our cybersecurity team specializes in threat detection and prevention.
    AI: Cybersecurity is a hot topic! What strategies or technologies does your team employ for effective threat detection?

    User: We use a combination of machine learning algorithms and behavior analysis to detect and mitigate potential threats.
    AI: Machine learning plays a key role! How do you ensure the adaptability of your machine learning algorithms to evolving cybersecurity threats?

    User: Regular updates and continuous monitoring help us stay ahead of new threats.
    AI: Proactive approach, I see! Shifting gears a bit, can you share any initiatives your company has undertaken to promote employee well-being?

    User: We offer flexible work hours and wellness programs to prioritize our employees' well-being.
    AI: Employee well-being is crucial! How have these initiatives positively influenced the overall work culture and job satisfaction among your team members?

    User: Our team appreciates the flexibility, leading to improved job satisfaction and a positive work environment.
    AI: It's great to hear that! Looking towards the future, are there any specific technological trends or advancements your company is keeping an eye on?

    User: Quantum computing and edge computing are two areas we're closely monitoring for potential applications.
    AI: Quantum and edge computing are on the horizon! How do you envision these technologies impacting the landscape of your industry in the coming years?

    User: Quantum computing could revolutionize data processing, and edge computing could enhance real-time data analysis, both contributing to more advanced solutions.
    AI: Exciting possibilities! Lastly, do you have any upcoming collaborations or partnerships that you're particularly excited about?
    User: We're exploring partnerships with research institutions to further advance our AI and cybersecurity capabilities.

    AI: Collaborations in research sound promising! How do you anticipate these partnerships will contribute to the growth and innovation within your company?
    User: Collaborating with research institutions will bring fresh perspectives and access to cutting-edge research, fostering innovation within our teams.

    AI: That sounds like a strategic approach! Thank you for sharing these insights into ABC Innovations. Is there anything specific you'd like to highlight or elaborate on?
    User: Not at the moment, but feel free to ask if you have more questions or if there's anything specific you'd like to know.

    AI: Absolutely! I'll keep that in mind. It was a pleasure learning more about ABC Innovations. If there's ever anything you'd like to discuss or update, feel free to reach out. Thank you for your time!
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

  const agentWithChatHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    // getMessageHistory: (_sessionId) => messageHistory,
    getMessageHistory: (sessionId) =>
      new RedisChatMessageHistory({
        sessionId,
        client: redisClient,
      }),
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  });

  return agentWithChatHistory;
}

async function generateTrainingAgentResponse(
  userQuery,
  knowledgeBaseName,
  threadId
) {
  if (!agent) {
    agent = await initializeAgent();
  }

  console.log("executing agent now...");

  const response = await agent.invoke(
    {
      input: userQuery,
      collectionName: knowledgeBaseName,
    },
    {
      configurable: {
        sessionId: threadId || "foo",
      },
    }
  );

  return response.output;
}

module.exports = {
  generateTrainingAgentResponse,
};
