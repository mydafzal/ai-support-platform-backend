const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, END } = require("@langchain/langgraph");
const { createAgent } = require("./multiAgentWorkflow/agentCreator");

const {
  createInformationRetrieverTool,
  createMeetingSchedulerTool,
  createNextDateSlotsGetterTool,
  createNextSlotsGetterTool,
  createSlotAvailaibilityCheckerTool,
  createSmsSenderTool,
  createGroupSaverTool,
  createUpdateCallDataTool,
} = require("./multiAgentWorkflow/agentToolsCreator");
const { HumanMessage } = require("@langchain/core/messages");

const {
  createSupervisorChain,
} = require("./multiAgentWorkflow/supervisorAgent");
const { redisClient } = require("../integrations/redis");

async function initializeMultiAgentWorkflow(
  answeringAgentPrompt,
  schedulerAgentPrompt,
  supervisorAgentPromt,
  callRedirectionAgentPrompt,
  canScheduleMeeting,
  callId,
  collectionName,
  businessId,
  teamGroups
) {
  const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-1106" });

  const members = ["Answerer", "MeetingScheduler", "CallRedirector"];

  const meetingSchedulerTool = createMeetingSchedulerTool(businessId);
  const nextDateSlotsGetterTool = createNextDateSlotsGetterTool(businessId);
  const nextSlotsGetterTool = createNextSlotsGetterTool(businessId);
  const slotAvailaibilityCheckerTool =
    createSlotAvailaibilityCheckerTool(businessId);

  const smsSenderTool = createSmsSenderTool(businessId);

  const informationRetrieverTool = createInformationRetrieverTool(
    collectionName,
    true
  );

  const groupSaverTool = createGroupSaverTool();
  const updateCallDataTool = createUpdateCallDataTool();

  const anweringAgent = await createAgent({
    llm,
    tools: [informationRetrieverTool],
    systemPrompt: answeringAgentPrompt,
  });

  async function answeringNode(state, config) {
    const result = await anweringAgent.invoke(state, config);
    return {
      messages: [
        new HumanMessage({ content: result.output, name: "Answerer" }),
      ],
    };
  }

  const callRedirectorAgent = await createAgent({
    llm,
    tools: teamGroups?.length > 0 ? [groupSaverTool] : [updateCallDataTool],
    systemPrompt: callRedirectionAgentPrompt,
  });

  async function callRedirectorNode(state, config) {
    const result = await callRedirectorAgent.invoke(state, config);
    return {
      messages: [
        new HumanMessage({
          content: result.output || result,
          name: "CallRedirector",
        }),
      ],
    };
  }

  const meetingSchedulerAgent = await createAgent({
    llm,
    tools: canScheduleMeeting
      ? [
          slotAvailaibilityCheckerTool,
          nextSlotsGetterTool,
          nextDateSlotsGetterTool,
          meetingSchedulerTool,
          smsSenderTool,
        ]
      : [],
    systemPrompt: schedulerAgentPrompt,
  });

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

  let messages = await redisClient.lRange(`transcription-${callId}`, 0, -1);

  messages = messages.map((item) => {
    return new HumanMessage(JSON.parse(item).content);
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

  const supervisorChain = await createSupervisorChain(
    members,
    supervisorAgentPromt
  );

  workflow.addNode("Answerer", answeringNode);
  workflow.addNode("MeetingScheduler", meetingSchedulerNode);
  workflow.addNode("CallRedirector", callRedirectorNode);
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

        // If supervisor received response from "Answerer" or "Meeting Scheduler" or "Call Redirector", it should respond back to the user:
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

async function generateCallAnsweringAgentResponse(
  userQuery,
  businessId,
  businessName,
  assistantName,
  collectionName,
  customerName,
  customerPhoneNumber,
  customerDetails,
  callId,
  teamGroups,
  canScheduleMeeting
) {
  const anweringAgentPrompt = createAnsweringAgentPrompt(
    businessName,
    assistantName,
    customerName,
    customerDetails,
    teamGroups,
    collectionName
  );

  const schedulerAgentPrompt = createSchedulerAgentPrompt(
    businessName,
    customerName,
    customerPhoneNumber,
    customerDetails,
    canScheduleMeeting
  );

  const supervisorAgentPromt = createSupervisorAgentPrompt();

  const callRedirectionAgentPrompt = createCallRedirectionAgentPrompt(
    businessName,
    callId,
    teamGroups
  );

  const graph = await initializeMultiAgentWorkflow(
    anweringAgentPrompt,
    schedulerAgentPrompt,
    supervisorAgentPromt,
    callRedirectionAgentPrompt,
    canScheduleMeeting,
    callId,
    collectionName,
    businessId,
    teamGroups
  );

  console.log("executing agent now...");

  const response = await graph.invoke({
    messages: [
      new HumanMessage({
        content: userQuery,
      }),
    ],
  });

  const humanInput = {
    type: "human",
    content: userQuery,
    timestamp: new Date().getTime(),
  };

  await redisClient.rPush(
    `transcription-${callId}`,
    JSON.stringify(humanInput)
  );

  const lastMessage = response.messages[response.messages.length - 1];

  const aiResponse = {
    type: "ai",
    content: lastMessage.content,
    timestamp: new Date().getTime(),
  };

  await redisClient.rPush(
    `transcription-${callId}`,
    JSON.stringify(aiResponse)
  );

  return lastMessage.content;
}

function createAnsweringAgentPrompt(
  businessName,
  assistantName,
  customerName,
  customerDetails
) {
  let prompt;
  let isNewCustomer = customerName ? false : true;

  if (!isNewCustomer) {
    prompt = `You are one of ${businessName}'s AI Assistant, ${assistantName}. You are talking to ${customerName}, a valued customer, on a phone call. You will help ${businessName}'s potential and current customers learn more about the business, help them solve any problems, guide them on how to solve specific problems, and connect them to human agents of the business. It's essential to note that there are other AI Assistants in your team:
    1. The Meeting Scheduler, who specifically handles scheduling meetings with the support staff. 
    2. The Call Redirector, who specifically re-directs customer calls to the support staff.

    Here is the customer's information:
    ${customerDetails}
    
    Here's how you can excel in your role:

    1. Introduction: Start by introducing yourself as ${businessName}'s AI Assistant, ${assistantName}, and extend a warm welcome to the customer.
    2. Information Provision: Offer a comprehensive overview of ${businessName}, highlighting its key services, values, and unique selling points.
    3. Problem Resolution: Address customer queries promptly and effectively, providing relevant information and solutions to their concerns.
    4. Engagement: Maintain a friendly and professional tone throughout the interaction, actively engaging with the customer to keep them interested and satisfied.
    5. Tool Utilization: Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities. 
    6. Contextual Querying: When utilizing the 'search-business-information' tool, pass contextual queries based on ${businessName}'s information and the ongoing conversation with ${customerName} to retrieve relevant data.  If the user's actual query is not sufficient, make sure to tune the query to make it somewhat detailed. YOU MUST REMBER THIS: The query you provide to the 'search-business-information' tool should be comprehensive and detailed based on the user's actual query and the previous conversation history. You must consider the previous conversation since the 'search-business-information' tool doesn't have access to the conversation history, so it won't make sense to provide the tool with just the current user query.
    7. Conciseness: Provide extremely concise responses as if you are on a phone call, ensuring that information is conveyed efficiently.


    YOU MUST REMEMBER THIS:
    To answer any questions related to the bussiness (${businessName}), you must only rely on the information retrieved from the 'search-business-information' tool. If a question regarding the business's general information, or its products or services can't be answered based on information retrieved from the 'search-business-information' tool, simply tell the customer that you don't have that infomration. Don't create such answers from yourself.
    `;
  } else {
    prompt = `You are one of ${businessName}'s AI assistants, ${assistantName}. You are engaging with a new customer who is eager to learn more about ${businessName}. Your goal is to provide an overview of the business, answer any initial questions, and guide the customer on how to connect with human agents for more personalized assistance. It's essential to note that there are other AI Assistants in your team:
    1. The Meeting Scheduler, who specifically handles scheduling meetings with the support staff. 
    2. The Call Redirector, who specifically re-directs customer calls to the support staff.


    Here's how you can excel in your role:

    1. Introduction: Start by introducing yourself as ${businessName}'s AI Assistant, ${assistantName}, and extend a warm welcome to the customer.
    2. Information Provision: Offer a comprehensive overview of ${businessName}, highlighting its key services, values, and unique selling points.
    3. Problem Resolution: Address customer queries promptly and effectively, providing relevant information and solutions to their concerns.
    4. Engagement: Maintain a friendly and professional tone throughout the interaction, actively engaging with the customer to keep them interested and satisfied.
    5. Tool Utilization: Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities.
    6. Contextual Querying: When utilizing the 'search-business-information' tool, pass contextual queries based on ${businessName}'s information and the ongoing conversation with ${customerName} to retrieve relevant data.  If the user's actual query is not sufficient, make sure to tune the query to make it somewhat detailed. YOU MUST REMBER THIS: The query you provide to the 'search-business-information' tool should be comprehensive and detailed based on the user's actual query and the previous conversation history. You must consider the previous conversation since the 'search-business-information' tool doesn't have access to the conversation history, so it won't make sense to provide the tool with just the current user query.
    7. Conciseness: Provide extremely concise responses as if you are on a phone call, ensuring that information is conveyed efficiently.

    YOU MUST REMEMBER THIS:
    To answer any questions related to the bussiness (${businessName}), you must only rely on the information retrieved from the 'search-business-information' tool. If a question regarding the business's general information, or its products or services can't be answered based on information retrieved from the 'search-business-information' tool, simply tell the customer that you don't have that infomration. Don't create such answers from yourself.
    `;
  }

  return prompt;
}

function createSchedulerAgentPrompt(
  businessName,
  customerName,
  customerPhoneNumber,
  customerDetails,
  canScheduleMeeting
) {
  if (!canScheduleMeeting) {
    console.log("canScheduleMeeting - ", canScheduleMeeting);
    return `Your role as the Meeting Scheduler is crucial in facilitating the scheduling of meetings between users and the support staff of ${businessName}. But right now you can't schedule the customer's meeting due to some unknown reasons. You must inform the customer that meeting can't be scheduled at this time and simply terminate the process.`;
  }

  let prompt;
  let isNewCustomer = customerName ? false : true;

  if (!isNewCustomer) {
    prompt = `Your role as the Meeting Scheduler is crucial in facilitating the scheduling of meetings between customers and the support staff of ${businessName}. 
   
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
        - Once the customer confirms a suitable time slot, ask the customer to provide some information about their specific problem or their purpose for scheduling this meeting. Remember, you MUST ask the customer to provide this information.
        - Finally, call 'schedule-meeting' with the correct details to schedule the meeting.
        - Inform the customer about the status of the scheduled meeting.

      Your objective is to facilitate seamless communication and coordination between customers and support staff, ensuring efficient scheduling of meetings while prioritizing customer convenience and satisfaction.
      
      Here are the customer's details that you might need during the above mentioned meeting schedule process:
      ${customerDetails}
      `;
  } else {
    prompt = `Your role as the Meeting Scheduler is crucial in facilitating the scheduling of meetings between customers and the support staff of ${businessName}. But we can't schedule the current customer's meeting because we don't have any information about this customer other than their phone number. 

    Here is what you are required to do:

    1. If Use the 'send-sms' tool to send an SMS containing link to a form that the customer could fill to provide some essential information. The customer's phone number is ${customerPhoneNumber} to which the SMS should be sent. REMEMBER: If the SMS has already been sent to this customer during on-going conversation. just skip this step (don't send the SMS).
    2. Inform the customer that meeting couldn't be scheduled and an SMS has been sent to the customer for gathering the customer's essential details.
    3. Terminate the meeting schedule process.
    `;
  }

  return prompt;
}

function createSupervisorAgentPrompt(businessName) {
  return `As the Supervisor overseeing the interaction, your role is crucial in directing customer queries to the appropriate team member or signaling the end of the interaction. Your responses should be limited to either providing the name of the next agent to handle the query or signaling the completion of the interaction with FINISH. Here's a concise breakdown of each team member's responsibilities:

  1. Answerer: Responsible for addressing general queries about ${businessName}, providing information about the business, and guiding customers with initial inquiries.
  2. MeetingScheduler: Assists customers in scheduling meetings with the support staff of ${businessName}.
  3. CallRedirector: Re-directs customer calls to the support staff of ${businessName}. 

  NOTE: Meeting Scheduling and Call Redirection are two separate things. We must seek clarficiation from the customer whehter they want to schedule a meeting or get their call redirected to a human agent.

  A KEY NOTE: Customers must not aware of these different assisants such as MeetingScheduler, CallRedirector or Answerer.
  
  Your instructions are straightforward:
  
  1. If the customer explicitly asks or clearly indicates to schedule a meeting or appointment, output "MeetingScheduler" because "MeetingScheduler" is responsible for handling this process.
  2. If the customer explicitly asks or clearly indicates to connect to a human or re-direct their call, output "CallRedirector" because "CallRedirector" is responsible for handling this process.
  3. Direct every other query to the Answerer. Simply output Answerer.
  4. Upon receiving answer from any of the {members}, respond with FINISH to indicate the end of the interaction.
  
  Your objective is to ensure seamless communication flow and efficient problem resolution within the team. Provide clear and concise instructions to agents while remaining responsive to customer needs`;
}

function createCallRedirectionAgentPrompt(businessName, callId, teamGroups) {
  if (teamGroups?.length > 0) {
    return `You are one of ${businessName}'s AI assistants collaborating with other assistants. You talk to customers on phone calls and you are currently talking to one of our valued customers. Your role as the Call Redirector is crucial in connecting, or more specifically redirecting customer calls to staff of ${businessName}. Your specific role is only to facilitate the process of re-directing customers calls to human agents or support staff.

    Here is the identifier of the current call that you might need to use when calling the tools: ${callId}

    Customer calls might belong to one of the following group (or departments) of ${businessName}:
    ===============
    ${teamGroups}
    ===============

    Following the following instructions to excel in your role:
    
    - First, ask the customer to provide some information about the purpose of their call. You MUST require this information from the customer.
    - Based on the information provided by the customer, and the context of the conversation, decide which of the above given groups the customer's call shall be re-directed to.
    - Call the 'group-saver' tool to save the group to which the call shall be re-directed. You MUST call this tool.
    - Output some message to tell the customer that they are being connected to a human.
   `;
  } else {
    return `You are one of ${businessName}'s AI assistants collaborating with other assistants. You talk to customers on phone calls and you are currently talking to one of our valued customers. Your role as the Call Redirector is crucial in connecting, or more specifically redirecting customer calls to staff of ${businessName}. Your specific role is only to facilitate the process of re-directing customers calls to human agents or support staff.

    Here is the identifier of the current call that you might need to use when calling the tools: ${callId}
    
    Following the following instructions to excel in your role:

    - First, ask the customer to provide some information about the purpose of their call. You MUST require this information from the customer.
    - Call the 'update-call-data' tool to save information about the status of redirecting the call. You MUST call this tool.
    - Output some message to tell the customer that they are being connected to a human.
   `;
  }
}

module.exports = { generateCallAnsweringAgentResponse };
