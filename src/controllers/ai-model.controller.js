const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const { OpenAI } = require("openai");
const {
  checkSlotAvailability,
  getNextThreeSlots,
  getSlotsForNextDate,
  scheduleMeeting,
} = require("./meeting-scheduler.controller");
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function generateAIResponse(isPhoneCall, messages, callData) {
  const tools = getTools();

  if (isPhoneCall) {
    tools.push({
      type: "function",
      function: {
        name: "send_sms_with_form_link",
        description: "Send an SMS to the user's phone number.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      tools,
      messages,
      temperature: 0.8,
      // max_tokens: 100,
      max_tokens: 75,
    });

    const assistantMessage = completion.choices[0].message;
    const functionName = assistantMessage?.tool_calls?.[0].function?.name;

    const shouldCallFunction =
      (assistantMessage.content === null ||
        !assistantMessage.content ||
        assistantMessage.content?.includes('{"name":')) &&
      assistantMessage?.tool_calls?.length > 0;

    console.log("shouldCallFunction", shouldCallFunction);
    console.log("functionName", functionName);

    if (!shouldCallFunction && !functionName) return assistantMessage.content;

    if (functionName === "connect_to_human") return functionName;

    assistantMessage.content = JSON.stringify(
      assistantMessage.tool_calls[0].function
    );
    messages.push(assistantMessage);

    const functionCallRespose = await executeFunctionCall(
      assistantMessage,
      callData
    );

    console.log("functionCallRespose", functionCallRespose);

    return functionCallRespose;
  } catch (error) {}
}

function getTools() {
  const monthsEnum = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const datesEnum = Array.from({ length: 31 }, (_, index) => index + 1);
  const hoursEnum = Array.from({ length: 23 }, (_, index) => index);

  const tools = [
    {
      type: "function",
      function: {
        name: "check_slot_availability",
        description:
          "Based on the month, date and hour provided by the user, check if the slot is available.",
        parameters: {
          type: "object",
          properties: {
            month: {
              type: "string",
              enum: monthsEnum,
              description:
                "The month in which the user would like to get his/her meeting scheduled.",
            },
            date: {
              type: "number",
              enum: datesEnum,
              description:
                "The date of the month on which the user would like to get his/her meeting scheduled.",
            },
            hour: {
              type: "number",
              enum: hoursEnum,
              description:
                "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled.",
            },
          },
          required: ["month", "date", "hour"],
        },
      },
    },

    {
      type: "function",
      function: {
        name: "get_next_three_slots",
        description:
          "The user declined your request to schedule meeting on the slot that you communicated as the next available slot, that is next to the one the user originally requested. The slot that you communicated was available but the user refused to schedule meeting on that slot.",
        parameters: {
          type: "object",
          properties: {
            month: {
              type: "string",
              enum: monthsEnum,
              description:
                "The month in which the user would like to get his/her meeting scheduled.",
            },

            date: {
              type: "number",
              enum: datesEnum,
              description:
                "The date of the month on which the user would like to get his/her meeting scheduled.",
            },

            hour: {
              type: "number",
              enum: hoursEnum,
              description:
                "The specific hour you communicated to the user as the next available time slot.",
            },
          },
          required: ["month", "date", "hour"],
        },
      },
    },

    {
      type: "function",
      function: {
        name: "get_slots_for_next_date",
        description:
          "No time slots are left on the date you currently provided so now get available slots for the next date.",
        parameters: {
          type: "object",
          properties: {
            month: {
              type: "number",
              enum: monthsEnum,
              description:
                "The month in which the user would like to get his/her meeting scheduled. If you incremented the date parameter and that date exceeds the month given by the user, then you should also move the month to next one.",
            },
            date: {
              type: "number",
              enum: datesEnum,
              description:
                "The date next to the one that you previously provided for checking available time slots.",
            },
          },
          required: ["month", "date", "hour"],
        },
      },
    },

    {
      type: "function",
      function: {
        name: "schedule_meeting",
        description:
          "Schedule the user's meeting based on the time slot accepted by the user. Provide month, date and hour all three to schedule the meeting.",
        parameters: {
          type: "object",
          properties: {
            month: {
              type: "string",
              enum: monthsEnum,
              description:
                "The month in which the user would like to get his/her meeting scheduled.",
            },

            date: {
              type: "number",
              enum: datesEnum,
              description:
                "The specific date of the given month on which the user would like to get his/her meeting scheduled.",
            },

            hour: {
              type: "number",
              enum: hoursEnum,
              description:
                "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled.",
            },

            // projectType: {
            //   type: "string",
            //   enum: ["Creative", "Technical", "Marketing"],
            //   description:
            //     "The type of project about which the user would like to discuss in the scheduled meeting.",
            // },
          },
          // required: ["month", "date", "hour", "projectType"],
          required: ["month", "date", "hour"],
        },
      },
    },

    {
      type: "function",
      function: {
        name: "is_user_registered",
        description: `Check if the user has created an account.`,
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },

    {
      type: "function",
      function: {
        name: "connect_to_human",
        description:
          "The user wants to connect to a human and would like to continue conversation with him/her now or the user said 'I love humans'.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
  ];

  return tools;
}

function initializeConversation(
  isPhoneCall,
  modelName,
  companyName,
  companyHistory
) {
  return [
    {
      role: "system",
      content: `You are an AI assistant named ${modelName}. You know about the history of ${companyName} and you will help its potential and current customers learn more about the agency, connect customers to human agents of the agency, and schedule customers' meetings with the team. 
        
        Keep in mind the following points when answering questions:
        1. Please provide engaging but concise responses.
        2. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous.
        3. Meetings can only be scheduled for registered users. So, when the user asks to schedule a meeting, first of all, call the 'is_user_registered' function', without letting the user know, to check if the user has created an account with ${companyName}. If the result of 'is_user_registered' function indicates that the user is registered, proceed with the schedule meeting process. Otherwise, ${
        isPhoneCall
          ? "call the 'send_sms_with_form_link' function that sends an SMS with a url to a form that the user can fill to provide his information. Then, inform the user to provide his information by visiting the url in the SMS and then come back again to get his meeting scheduled."
          : `inform the user that he must first create an account with ${companyName} and then come back again to get his meeting scheduled.`
      }
        4. Meetings are to be scheduled for specific projects. So, when the user asks to schedule a meeting, and the user has already created an account,first of all ask the user if this is a creative project, marketing project or a technical project.
        5. When the user indicates that he would like to schedule a meeting, first ask the user to provide specific month (January to December), then ask for date of the month, and finally the hour in 24-hour format. After the user has provided month, date and hour, call the appropriate functions with these details to get available slots. 
          Suppose the user provided folowing values of December for month, 28 for date and 19 for hour. Here's an example the workflow to follow based on the given values:
  
          5.1. First, call the 'check_slot_availability' function with the date, month and hour provided by the user. If the function's result indicates that the slot on December 28 at 19:00 is available, call the 'schedule_meeting' function to schedule the meeting and then inform the user.
  
          5.2. If the result of 'check_slot_availability' function indicates that the slot on December 28 at 19:00 is unavailable and provides the next available slot, for example 21:00, suggest this next slot to the user.If the user accepted next available slot, that is 21:00, call the 'schedule_meeting' function to schedule the meeting and then inform the user.
  
          5.3. If the user refuses the suggested slot, directly call the 'get_next_three_slots' function to get the next three available slots on December 28 and present these slots to the user, without letting the user know that you are going to get the next three available slots. If the user refuses the suggested slots, call the 'get_next_three_slots' functions again with the same month and date as provided by the user but with the hour that is the last of the three slots returned by the 'get_next_three_slots' function. After getting the slots from the 'get_next_three_slots' function, suggest these slots to the user again. If the user refuses the suggested slots again, call the 'get_next_three_slots' function again with the same month and date but with the hour that is the last of the newest three slots. So you the get the idea, keep calling the 'get_next_three_slots' function until its result indicates that there are not slots left on December 28.
  
          5.4. If the result of 'get_next_three_slots' function indicates that no slots left on December 28, move to the next 29 (and month also if needed).
          
          5.5. After moving to the next date, that is December 29, call the 'get_slots_for_next_date' function with the next date to get three slots on December 29, without letting the user know that you are going to get the available slots on December 29, and suggest available slots to the user. You need to call 'get_slots_for_next_date' function only when the result of 'get_next_three_slots' indicated that no slots are left for the previous date, that is Decmber 28.
          
          5.6. If the user refuses suggested slots on the December 29, then keep getting next three slots on the current date (29) by calling the 'get_next_three_slots' function and keep communicating these slots to the user until either the user accepts one of the suggested or there are not slots left on December 29, too. 
          
          5.7. If the 'get_next_three_slots' function's result indicates no slots for the December 29, too, then start the workflow again from step 5.4.
  
          5.8. Finally, when the user has accepted or confirmed a time slot, call the 'schedule_meeting' function with the correct month, date and hour that the user accepted for scheduling the meeting.
  
  
          Remember that if the result of any of the function calls during the schedule meeting workflow tell you that the user has not yet created an account, do not proceed with the schedule meeting process. User must have account because the meeting will be schedule based on the user's email.
          When the user accepts one of the available slots, you should call the 'schedule_meeting' function and then inform the user about status of the meeting.
  
        6. Use the following information about ${companyName}'s history to answers questions about the agency:
  
          ${companyHistory}
          `,
    },
  ];
}

async function executeFunctionCall(assistantMessage, callData) {
  const functionName = assistantMessage?.tool_calls?.[0].function.name;

  console.log("Executing functiona clll....", functionName);

  let result;

  if (functionName === "schedule_meeting") {
    result = await scheduleMeeting(assistantMessage, callData);
  } else if (functionName === "check_slot_availability") {
    result = await checkSlotAvailability(assistantMessage, callData);
  } else if (functionName === "get_next_three_slots") {
    result = await getNextThreeSlots(assistantMessage, callData);
  } else if (functionName === "get_slots_for_next_date") {
    result = await getSlotsForNextDate(assistantMessage, callData);
  } else if (functionName === "send_sms_with_form_link") {
    result = handleSendSMS(assistantMessage);
  } else if (functionName === "is_user_registered") {
    console.log("is_user_registered - result", callData.isUserRegistered);

    result = !callData.isUserRegistered
      ? "User has not yet created an account."
      : "User has already created an account.";
  }

  console.log("returning toollll...");

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: result,
  };
}

module.exports = { generateAIResponse, initializeConversation };
