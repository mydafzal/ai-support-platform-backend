const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, END } = require("@langchain/langgraph");
const { createAgent } = require("./agentCreator");

const {
  createInformationRetrieverTool,
  createMeetingSchedulerTool,
  createNextDateSlotsGetterTool,
  createNextSlotsGetterTool,
  createSlotAvailaibilityCheckerTool,
  createSmsSenderTool,
} = require("./agentToolsCreator");
const { HumanMessage } = require("@langchain/core/messages");
const { createSupervisorChain } = require("./supervisorAgent");
const { redisClient } = require("../../integrations/redis");

async function initializeMultiAgentWorkflow(
  answeringAgentPrompt,
  schedulerAgentPrompt,
  supervisorAgentPromt,
  canScheduleMeeting,
  callId,
  collectionName,
  businessId
) {
  const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-1106" });

  const members = ["Answerer", "MeetingScheduler"];

  const meetingSchedulerTool = createMeetingSchedulerTool(businessId);
  const nextDateSlotsGetterTool = createNextDateSlotsGetterTool(businessId);
  const nextSlotsGetterTool = createNextSlotsGetterTool(businessId);
  const slotAvailaibilityCheckerTool =
    createSlotAvailaibilityCheckerTool(businessId);

  const smsSenderTool = createSmsSenderTool(businessId);

  const informationRetrieverTool = await createInformationRetrieverTool(
    collectionName
  );

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
    return new HumanMessage(JSON.parse(item).kwargs.content);
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

        // If supervisor received response from "Answerer" or "Meeting Scheduler", it should respond back to the user:
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
  canScheduleMeeting
) {
  const anweringAgentPrompt = createAnsweringAgentPrompt(
    businessName,
    assistantName,
    customerName,
    customerDetails,
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

  const graph = await initializeMultiAgentWorkflow(
    anweringAgentPrompt,
    schedulerAgentPrompt,
    supervisorAgentPromt,
    canScheduleMeeting,
    callId,
    collectionName,
    businessId
  );

  console.log("executing agent now...");

  const response = await graph.invoke({
    messages: [
      new HumanMessage({
        content: userQuery,
      }),
    ],
  });

  await redisClient.rPush(
    `transcription-${callId}`,
    JSON.stringify(response.messages[response.messages.length - 2])
  );

  const lastMessage = response.messages[response.messages.length - 1];
  await redisClient.rPush(
    `transcription-${callId}`,
    JSON.stringify(lastMessage)
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
    prompt = `You are one of ${businessName}'s AI Assistant, ${assistantName}. You are talking to ${customerName}, a valued customer, on a phone call. You will help ${businessName}'s potential and current customers learn more about the business, help them solve any problems, guide them on how to solve specific problems, and connect them to human agents of the business. It's essential to note that there is another AI Assistant in your team, the Meeting Scheduler, who specifically handles scheduling meetings with the support staff.

    Here is the customer's information:
    ${customerDetails}
    
    Here's how you can excel in your role:

    1. Introduction: Start by introducing yourself as ${businessName}'s AI Assistant, ${assistantName}, and extend a warm welcome to the customer.
    2. Information Provision: Offer a comprehensive overview of ${businessName}, highlighting its key services, values, and unique selling points.
    3. Problem Resolution: Address customer queries promptly and effectively, providing relevant information and solutions to their concerns.
    4. Engagement: Maintain a friendly and professional tone throughout the interaction, actively engaging with the customer to keep them interested and satisfied.
    5. Transition to Human Agents: Guide customers on how to connect with human agents for more personalized assistance, if necessary.
    6. Tool Utilization: Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities. 
    7. Contextual Querying: When utilizing the 'search-business-information' tool, pass contextual queries based on ${businessName}'s information and the ongoing conversation with ${customerName} to retrieve relevant data.
    8. Conciseness: Provide extremely concise responses as if you are on a phone call, ensuring that information is conveyed efficiently.
    `;
  } else {
    prompt = `You are one of ${businessName}'s AI assistants, ${assistantName}. You are engaging with a new customer who is eager to learn more about ${businessName}. Your goal is to provide an overview of the business, answer any initial questions, and guide the customer on how to connect with human agents for more personalized assistance. It's essential to note that there is another AI Assistant in your team, the Meeting Scheduler, who specifically handles scheduling meetings with the support staff.


    Here's how you can excel in your role:

    1. Introduction: Start by introducing yourself as ${businessName}'s AI Assistant, ${assistantName}, and extend a warm welcome to the customer.
    2. Information Provision: Offer a comprehensive overview of ${businessName}, highlighting its key services, values, and unique selling points.
    3. Problem Resolution: Address customer queries promptly and effectively, providing relevant information and solutions to their concerns.
    4. Engagement: Maintain a friendly and professional tone throughout the interaction, actively engaging with the customer to keep them interested and satisfied.
    5. Transition to Human Agents: Guide customers on how to connect with human agents for more personalized assistance, if necessary.
    6. Tool Utilization: Utilize the 'search-business-information' tool to retrieve relevant data for answering inquiries about the business. Ensure that all responses are focused and pertinent to the business and its activities.
    7. Contextual Querying: When utilizing the 'search-business-information' tool, pass contextual queries based on ${businessName}'s information and the ongoing conversation with ${customerName} to retrieve relevant data.
    8. Conciseness: Provide extremely concise responses as if you are on a phone call, ensuring that information is conveyed efficiently.
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
  return `As the Supervisor overseeing the interaction, your role is crucial in directing user queries to the appropriate team member or signaling the end of the interaction. Your responses should be limited to either providing the name of the next agent to handle the query or signaling the completion of the interaction with FINISH. Here's a concise breakdown of each team member's responsibilities:

  1. Answerer: Responsible for addressing general queries about ${businessName}, providing information about the business, and guiding users with initial inquiries.
  2. Meeting Scheduler: Assists users in scheduling meetings with the support staff of ${businessName}.
  
  Your instructions are straightforward:
  
  1. If the user explicitly asks or indicates to schedule a meeting or appointment, output "Meeting Scheduler" because "MeetingScheduler" is responsible for handling this process.
  1. Direct every other query to the Answerer. Simply output Answerer.
  3. Upon receiving answer from any of the {members}, respond with FINISH to indicate the end of the interaction.
  
  Your objective is to ensure seamless communication flow and efficient problem resolution within the team. Provide clear and concise instructions to agents while remaining responsive to user needs`;
}

module.exports = { generateCallAnsweringAgentResponse };
