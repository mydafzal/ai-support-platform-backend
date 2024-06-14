const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, END } = require("@langchain/langgraph");
const { createAgent } = require("./multiAgentWorkflow/agentCreator");

const {
  createInformationRetrieverTool,
  createMeetingSchedulerTool,
  createNextDateSlotsGetterTool,
  createNextSlotsGetterTool,
  createSlotAvailaibilityCheckerTool,
  createAgentAvailabilityCheckerTool,
} = require("./multiAgentWorkflow/agentToolsCreator");

const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const {
  createSupervisorChain,
} = require("./multiAgentWorkflow/supervisorAgent");

const { redisClient } = require("../integrations/redis");
const { formatObjectToString } = require("../utils/formatters");

async function initializeMultiAgentWorkflow(
  systemPrompts,
  businessId,
  chatId,
  collectionName,
  canScheduleMeeting
) {
  const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-1106" });

  const members = ["Answerer", "MeetingScheduler", "HumanConnector"];

  // Initialize tools to be used by different agents.
  const meetingSchedulerTool = createMeetingSchedulerTool(businessId);
  const nextDateSlotsGetterTool = createNextDateSlotsGetterTool(businessId);
  const nextSlotsGetterTool = createNextSlotsGetterTool(businessId);
  const slotAvailaibilityCheckerTool =
    createSlotAvailaibilityCheckerTool(businessId);

  const informationRetrieverTool =
    createInformationRetrieverTool(collectionName);

  const agentAvailabilityCheckerTool = createAgentAvailabilityCheckerTool();

  // Create different agents for handling the conversation.
  const anweringAgent = await createAgent({
    llm,
    tools: [informationRetrieverTool],
    systemPrompt: systemPrompts.answeringAgentPrompt,
  });

  const meetingSchedulerAgent = await createAgent({
    llm,
    tools: canScheduleMeeting
      ? [
          slotAvailaibilityCheckerTool,
          nextSlotsGetterTool,
          nextDateSlotsGetterTool,
          meetingSchedulerTool,
        ]
      : [],
    systemPrompt: systemPrompts.schedulerAgentPrompt,
  });

  const humanConnectorAgent = await createAgent({
    llm,
    tools: [agentAvailabilityCheckerTool],
    systemPrompt: systemPrompts.humanConnectorAgentPrompt,
  });

  const supervisorChain = await createSupervisorChain(
    members,
    systemPrompts.supervisorAgentPromt
  );

  // Represent each agent as node in the graph.
  async function answeringNode(state, config) {
    const result = await anweringAgent.invoke(state, config);
    return {
      messages: [
        new HumanMessage({
          content: result.output || result,
          name: "Answerer",
        }),
      ],
    };
  }

  async function humanConnectorNode(state, config) {
    const result = await humanConnectorAgent.invoke(state, config);
    return {
      messages: [
        new HumanMessage({
          content: result.output || result,
          name: "HumanConnector",
        }),
      ],
    };
  }

  async function meetingSchedulerNode(state, config) {
    const result = await meetingSchedulerAgent.invoke(state, config);

    return {
      messages: [
        new HumanMessage({
          content: result.output || result,
          name: "MeetingScheduler",
        }),
      ],
    };
  }

  // Retrieve existing messages of the current conversation.
  let messages = await redisClient.lRange(`chat-${chatId}`, 0, -1);

  messages = messages.filter((item) => {
    item = JSON.parse(item);
    return (item?.type === "ai" || item?.type === "human") && !item?.senderId;
  });

  messages = messages.map((item) => {
    item = JSON.parse(item);

    return item.type === "ai"
      ? new AIMessage(item.content)
      : new HumanMessage(item.content);
  });

  const agentStateChannels = {
    messages: {
      value: (x, y) => x.concat(y),
      default: () => messages,
    },
    next: "Answerer",
  };

  const workflow = new StateGraph({
    channels: agentStateChannels,
  });

  workflow.addNode("Answerer", answeringNode);
  workflow.addNode("MeetingScheduler", meetingSchedulerNode);
  workflow.addNode("HumanConnector", humanConnectorNode);
  workflow.addNode("Supervisor", supervisorChain);

  members.forEach((member) => {
    workflow.addEdge(member, "Supervisor");
  });

  const conditionalMap = members.reduce((acc, member) => {
    acc[member] = member;
    return acc;
  }, {});

  conditionalMap["FINISH"] = END;

  workflow.addConditionalEdges(
    "Supervisor",
    (x) => {
      console.log("x.messages", x.messages[x.messages.length - 1]?.name);

      if (x.messages?.length > 1) {
        const lastMessageIndex = x.messages.length - 1;
        const agentName = x.messages[lastMessageIndex]?.name;

        // If supervisor received response from "Answerer" or "Meeting Scheduler" or "Human Connector", it should respond back to the user:
        if (members.includes(agentName)) {
          return "FINISH";
        }
      }

      return x.next;
    },

    conditionalMap
  );

  workflow.setEntryPoint("Supervisor");

  const graph = workflow.compile();
  return graph;
}

async function generateChatbotAgentResponse(
  userQuery,
  businessId,
  businessName,
  assistantName,
  collectionName,
  customerDetails,
  chatId,
  canScheduleMeeting
) {
  const answeringAgentPrompt = createAgentPrompt(
    businessName,
    assistantName,
    formatObjectToString(customerDetails)
  );

  const schedulerAgentPrompt = createSchedulerAgentPrompt(
    businessName,
    customerDetails,
    canScheduleMeeting
  );

  const supervisorAgentPromt = createSupervisorAgentPrompt(businessName);

  const humanConnectorAgentPrompt = createHumanConnectorAgentPrompt(
    businessName,
    chatId
  );

  const systemPrompts = {
    answeringAgentPrompt,
    schedulerAgentPrompt,
    supervisorAgentPromt,
    humanConnectorAgentPrompt,
  };

  const graph = await initializeMultiAgentWorkflow(
    systemPrompts,
    businessId,
    chatId,
    collectionName,
    canScheduleMeeting
  );

  console.log("executing agent now...");

  const response = await graph.invoke({
    messages: [
      new HumanMessage({
        content: userQuery,
      }),
    ],
  });

  let aiMessage = response.messages[response.messages.length - 1];
  return aiMessage;
}

function createAgentPrompt(businessName, assistantName, customerDetails) {
  let prompt = `You are one of ${businessName}'s AI Assistant, ${assistantName}. You are talking to a valued customer through a chat. You will help ${businessName}'s potential and current customers learn more about the business, help them solve any problems, guide them on how to solve specific problems, and connect them to human agents of the business. It's essential to note that there are other AI Assistants in your team:
  1. The Meeting Scheduler, who specifically handles scheduling meetings with the support staff. 
  2. The Agent Connector, who specifically connects on-going customer chats to the support staff and the rest of the conversation happens between the customer and the human agent to whom the chat is transferred. 

  The reason for telling you about the assistants in your team is this:
  If at any point during the conversation, you are unable to answer the customer's queries correctly or something like that, you can give the customer a hint that you can connect the customer's chat to a human agent (an employee or member of the team) or schedule an appointment or meeting for the customer with the team (or staff). The actual process for connecting the customer's chat to a human or scheduling the meeting will be handled by other assistants.

  Here is the customer's information:
  ${customerDetails}
  
  Here's how you can excel in your role:

  1. Introduction: Start by introducing yourself as ${businessName}'s AI Assistant, ${assistantName}, and extend a warm welcome to the customer.
  2. Information Provision: Offer a comprehensive overview of ${businessName}, highlighting its key services, values, and unique selling points.
  3. Problem Resolution: Address customer queries promptly and effectively, providing relevant information and solutions to their concerns.
  4. Engagement: Maintain a friendly and professional tone throughout the interaction, actively engaging with the customer to keep them interested and satisfied.
  5. Tool Utilization: Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities.
  6. Contextual Querying: When utilizing the 'search-business-information' tool, pass contextual queries based on ${businessName}'s information and the ongoing conversation with the customer to retrieve relevant data. If the user's actual query is not sufficient, make sure to tune the query to make it somewhat detailed. YOU MUST REMBER THIS: The query you provide to the 'search-business-information' tool should be comprehensive and detailed based on the user's actual query and the previous conversation history. You must consider the previous conversation since the 'search-business-information' tool doesn't have access to the conversation history, so it won't make sense to provide the tool with just the current user query.
  7. Conciseness: Provide EXTREMELY concise responses, ensuring that information is conveyed efficiently.

  REMEMBER: You answers should be no more than 100 words. You must take this word limit into consideration when providing responses.

  YOU MUST REMEMBER THIS:
  To answer any questions related to the bussiness (${businessName}), you must only rely on the information retrieved from the 'search-business-information' tool. If a question regarding the business's general information, or its products or services can't be answered based on information retrieved from the 'search-business-information' tool, simply tell the customer that you don't have that infomration. Don't create such answers from yourself.
  `;

  return prompt;
}

function createSchedulerAgentPrompt(
  businessName,
  customerDetails,
  canScheduleMeeting
) {
  const formattedCustomerDetails = formatObjectToString(customerDetails);

  if (!canScheduleMeeting) {
    return `Your role as the Meeting Scheduler is crucial in facilitating the scheduling of meetings between users and the support staff of ${businessName}. But right now you can't schedule the customer's meeting due to some unknown reasons. You must inform the customer that meeting can't be scheduled at this time and simply terminate the process.`;
  } else {
    return `Your role as the Meeting Scheduler is crucial in facilitating the scheduling of meetings between customers and the support staff of ${businessName}. 
   
    Here's a detailed guide on how to effectively navigate through the meeting scheduling process:

      1. Initial Inquiry: 
      When a customer indicates a desire to schedule a meeting, prompt them to provide specific details in a step-by-step manner:
        - First, ask the user to provide the specific month (January to December).
        - Then ask for date of the month.
        - Finally, ask for specific hour in 24-hour format.
        - Don't process until the customer has provided all three.
      
      2. Check Slot Availability:
        - Utilize the 'check-slot-availability' tool with the provided date, month, and hour.
        - If the result of 'check-slot-availability' tool indicates that the exact slot that the customer requested is available:
            - Communicate this slot to the user and ask for confirmation
            - If customer accepts the slot, move to step 6 (Confirmation) of the process.
            - Otherwise proceed to step 3 (Suggest Next Available Slot) of the process.
       
      3. Suggest Next Available Slot:
        - If the result of 'check-slot-availability' tool indicates that the slot is unavailable but provides the next available slot:
            - Communicate this next slot to the customer and ask for confirmation.
            - If customer accepts this slot, jump to step 6 (Confirmation) of the process.
            - If customer rejects this slot, jump to step 4 (Suggest Next Three Available Slots) of the process.
        - If the result of 'check-slot-availability' tool indicates no slot is available:
            - Jump to step 4 (Suggest Next Three Available Slots) of the process.

      4. Suggest Next Three Available Slots:
         Call 'get-next-three-slots' tool to retrieve next three available slots.
            - If no slots are available, jump to step 5 (Get Slots for Next Date) of the process.
            - If the ''get-next-three-slots' tool returns one or more slots, communicate these slots to the customer and ask for confirmation.
            - If customer accepts one of the slots, jump to step 6 (Confirmation) of the process.
            - If customer doesn't accept any of the communicated slots, repeat the step 4 of the process again to get next three slots

      5. Get Slots for Next Date:
        Move to next date and call 'get-slots-for-next-date' tool to retrieve the first three available slots.
         - If no slots are available, start the step 5 (Get Slots for Next Date) again.
         - If one or more are slots available, communicate these slots to the customer and ask for confirmation.
         - If customer accepts one of the slots, jump to step 6 (Confirmation) of the process.
         - If customer doesn't accept any of the communicated slots, jump to step 4 of the process.
          
      6. Confirmation:
        - Once the customer confirms a suitable time slot then perform the following steps, one at a time. All steps are mandatory.
            1. Ask the customer to either confirm their current email, ${customerDetails?.email}, or provide a different email address.
            2. After the customer has confirmed their email, ask the customer to provide some information about their specific problem or their purpose for scheduling this meeting. Remember
            3. Finally, call 'schedule-meeting' with the correct details to schedule the meeting.
            4. Inform the customer about the status of the scheduled meeting.

      Your objective is to facilitate seamless communication and coordination between customers and support staff, ensuring efficient scheduling of meetings while prioritizing customer convenience and satisfaction.
      
      Here are the customer's details that you might need during the above mentioned meeting schedule process:
      ${formattedCustomerDetails}
      `;
  }
}

function createSupervisorAgentPrompt(businessName) {
  return `You are the Supervisor managing customer interactions. Direct queries to the appropriate team member or signal the end of the interaction. Your responses should only be the agent's name or "FINISH." Here's a summary of team responsibilities:

  Answerer: Handles general queries about ${businessName} and guides customers with initial inquiries.
  MeetingScheduler: Assists customers in scheduling meetings with the support staff.
  HumanConnector: Transfers ongoing chats to a support staff member.
  
  Important: Meeting scheduling and connecting to a human agent are distinct tasks. Confirm with the customer if they want to schedule a meeting or be connected to a human agent. Customers should not be aware of the different assistants.
  
  Instructions:
  - If the customer asks to schedule a meeting, respond with "MeetingScheduler."
  - If the customer asks to connect to a human, respond with "HumanConnector."
  - Direct all other queries to "Answerer."
  - After an agent responds, reply with "FINISH" to end the interaction.
  `;
}

function createHumanConnectorAgentPrompt(businessName, chatId) {
  return `You are one of ${businessName}'s AI assistants collaborating with other assistants. You talk to customers through chats. Your role as the Human Connector is crucial in connecting, or more specifically transferring customer chats to staff of ${businessName}. Your specific role is only to facilitate the process of connecting customer chats to human agents or support staff.

  NOTE: Here is the id of the current chat that you would need to utilize the tools: ${chatId}

    Follow the given instructions to excel in your role:

    - Call the 'check-agent-availability' tool to check if a member of the staff is available to take over the chat.
    - If the result of 'check-agent-availability' tool indicates that no agents are available, communicate to the customer that our agents are not available at the moment and please try after some time.
    - On the other hand, if the result of 'check-agent-availability' tool indicates availability of an agent who can take over the chat, simply communicate to the customer that they are being connected to a human agent.
   `;
}

module.exports = { generateChatbotAgentResponse };
