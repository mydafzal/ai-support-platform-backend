const Twilio = require("twilio");
const { OpenAI } = require("openai");
const { convertTextToSpeech } = require("./text-to-speech");
const { getAvailableTimeSlots } = require("./calendly");
const { getUser } = require("./firestore");
const {
  getConversationByUserId,
  updateConversation,
  addConversation,
} = require("./datastore");
const { addEventToGoogleCalendar } = require("./google-calendar");
const moment = require("moment");

const OPENAI_API_KEY = "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"; // cheetah account

async function handleTranscription(request, response) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  let callerId = request.body.From;

  if (callerId?.startsWith("client:")) {
    callerId = callerId.split(":")[1];
  }

  const conversation = getConversationByUserId(callerId);

  if (!conversation) {
    console.log("saying introduction....");

    addConversation(callerId, initializeConversation());

    // https://ai-backend-five.vercel.app

    twiml.play(
      "https://ai-backend-five.vercel.app/public/greeting-message-michael.mp3"
    );
  }

  twiml.gather({
    speechTimeout: 2,
    speechModel: "experimental_conversations",
    input: "speech",
    action: "https://ai-backend-five.vercel.app/twilio/respond",
    actionOnEmptyResult: true,
  });

  response.type("application/xml");
  return response.send(twiml.toString());
}

async function handleReponse(request, response) {
  let callerId = request.body.From;

  if (callerId?.startsWith("client:")) {
    callerId = callerId.split(":")[1];
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  let voiceInput = request.body.SpeechResult;

  console.log("voice input", voiceInput);

  if (!voiceInput) {
    // twiml.say("It's been a pleasure assisting you. Goodbye!");
    twiml.play(
      "https://ai-backend-five.vercel.app/public/goodbye-message-michael.mp3"
    );

    twiml.hangup();

    response.type("application/xml");
    return response.send(twiml.toString());
  }

  let conversation = getConversationByUserId(callerId);

  conversation.push({ role: "user", content: `${voiceInput}` });

  let aiResponse = await generateAIResponse(conversation);

  while (aiResponse?.role === "tool") {
    console.log("while");
    conversation.push(aiResponse);
    aiResponse = await generateAIResponse(conversation);
  }

  console.log("aiResponse", aiResponse);

  let connectToHuman = false;
  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
    connectToHuman = true;
  }

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

  conversation.push({ role: "assistant", content: `${aiResponse}` });

  // console.log("conversation - after", conversation);

  while (conversation.length > 20) {
    conversation.shift();
  }

  const textToSpeechFileURL = await convertTextToSpeech(cleanedAiResponse);

  console.log("cleanedAiResponse", cleanedAiResponse);
  console.log("textToSpeechFileURL", textToSpeechFileURL);

  twiml.play(textToSpeechFileURL);

  if (connectToHuman === true) {
    twiml
      .dial({
        callerId: "+923055952372",
        action: "https://ai-backend-five.vercel.app/twilio/dial",
        method: "POST",
      })
      .number("+923055952372");
  } else {
    // Redirect to the Function where the <Gather> is capturing the caller's speech
    twiml.redirect(
      {
        method: "POST",
      },
      `https://ai-backend-five.vercel.app/twilio/transcribe`
    );
  }

  response.type("application/xml");
  updateConversation(callerId, conversation);

  return response.send(twiml.toString());

  async function generateAIResponse(conversation) {
    return await createChatCompletion(conversation);
  }

  async function createChatCompletion(messages) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        tools: [
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
                    enum: [
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
                    ],
                    description:
                      "The month in which the user would like to get his/her meeting scheduled.",
                  },

                  date: {
                    type: "number",
                    enum: Array.from({ length: 31 }, (_, index) => index + 1),
                    description:
                      "The date of the month on which the user would like to get his/her meeting scheduled.",
                  },

                  hour: {
                    type: "number",
                    enum: Array.from({ length: 23 }, (_, index) => index),
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
                    enum: [
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
                    ],
                    description:
                      "The month in which the user would like to get his/her meeting scheduled.",
                  },

                  date: {
                    type: "number",
                    enum: Array.from({ length: 31 }, (_, index) => index + 1),
                    description:
                      "The specific date of the given month on which the user would like to get his/her meeting scheduled.",
                  },

                  hour: {
                    type: "number",
                    enum: Array.from({ length: 23 }, (_, index) => index),
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
                    enum: [
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
                    ],
                    description:
                      "The month in which the user would like to get his/her meeting scheduled. If you incremented the date parameter and that date exceeds the month given by the user, then you should also move the month to next one.",
                  },

                  date: {
                    type: "number",
                    enum: Array.from({ length: 31 }, (_, index) => index + 1),
                    description:
                      "The date next to the one that you previously provided for checking available time slots.",
                  },

                  // hour: {
                  //   type: "number",
                  //   enum: Array.from({ length: 23 }, (_, index) => index),
                  //   description:
                  //     "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled.",
                  // },
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
                "Schedule the user's meeting based on the time slot accepted by the user.",
              parameters: {
                type: "object",
                properties: {
                  month: {
                    type: "string",
                    enum: [
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
                    ],
                    description:
                      "The month in which the user would like to get his/her meeting scheduled.",
                  },

                  date: {
                    type: "number",
                    enum: Array.from({ length: 31 }, (_, index) => index + 1),
                    description:
                      "The specific date of the given month on which the user would like to get his/her meeting scheduled.",
                  },

                  hour: {
                    type: "number",
                    enum: Array.from({ length: 23 }, (_, index) => index),
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
              name: "connect_to_human",
              description:
                "The user wants to connect to a human and would like to continue conversation with him/her now or the user said 'I love humans'.",
              parameters: {
                type: "object",
                properties: {},
              },
            },
          },
        ],
        messages: messages,
        temperature: 0.8,
        max_tokens: 100,
      });

      const assistantMessage = completion.choices[0].message;

      console.log("assistantMessage.content", assistantMessage.content);
      console.log(
        " assistantMessage.tool_calls?.[0]",
        assistantMessage.tool_calls?.[0]
      );

      const shouldCallFunction =
        (assistantMessage.content === null ||
          !assistantMessage.content ||
          assistantMessage.content?.includes('{"name":')) &&
        assistantMessage?.tool_calls?.length > 0;

      console.log("shouldCallFunction", shouldCallFunction);

      if (!shouldCallFunction) {
        return assistantMessage.content;
      }

      if (
        assistantMessage?.tool_calls?.[0].function.name === "connect_to_human"
      ) {
        return functionName;
      }

      assistantMessage.content = JSON.stringify(
        assistantMessage.tool_calls[0].function
      );

      conversation.push(assistantMessage);
      return await executeFunctionCall(assistantMessage, twiml, request);
    } catch (error) {
      if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
        console.error("Error: OpenAI API request timed out."); // Log an error message indicating that the OpenAI API request timed out
        twiml.say(
          {
            // Create a TwiML say element to provide an error message to the user
            voice: "Polly.Joanna-Neural",
          },
          "I'm sorry, but it's taking me a little bit too long to respond. Let's try that again, one more time."
        );
        twiml.redirect(
          {
            // Create a TwiML redirect element to redirect the user to the /transcribe endpoint
            method: "POST",
          },
          `/transcribe`
        );
        response.appendHeader("Content-Type", "application/xml"); // Set the Content-Type header of the response to "application/xml"
        response.setBody(twiml.toString()); // Set the body of the response to the XML string representation of the TwiML response
        return callback(null, response); // Return the response to the callback function
      } else {
        console.error("Error during OpenAI API request:", error);
        throw error;
      }
    }
  }

  function formatConversation(conversation) {
    // let isAI = true;
    let isAI = false;

    const messages = [
      {
        role: "system",
        // content:
        //   "You are a creative, funny, friendly and amusing AI assistant named Adam. Please provide engaging but concise responses. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Prompt user to confirm the email address he/she provided by repeating the email address to the user. Don't assume how words in the user's email are to be spelled, ask for clarification if the spelling is ambiguous.",
        // content:
        //   "You are a creative, funny, friendly and amusing AI assistant named Adam. Please provide engaging but concise responses.",
        content: `You are a creative, funny, friendly and amusing AI assistant named Adam. You also know about the history of Cheetah Agency and you will help its potential and current customers learn more about the agency. 
        
        Keep in mind the following points when answering questions:
        1. Please provide engaging but concise responses. 
        2. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous.
        3. When user indicates that he would like to schedule a meeting, ask for specific month (January to December), date of the month, and the specific hour in 24-hour format separately. Ask user to first provide the month, then ask for date and finally ask for hour. Month, date and hour all are required and must be validated to confirm they make make a valid future date. After the user has provided all three, ask user for confirmation of the provided date by repeating it to the user.
        4. Use the following information about Cheetah Agency's history to answers questions about the agency:

          Summary of Cheetah Agency's History:

          Founding and Growth:
          Cheetah Agency was founded in 2006 by a team of visionaries with a focus on improving the world. Originally a design agency, it has evolved into a comprehensive agency covering creative, marketing, and product/software development across 50 global locations.

          Commitment to Excellence:
          With over 16 years of experience, Cheetah Agency has become an industry leader in delivering top-quality digital experiences and innovative solutions to help businesses achieve their goals. The agency emphasizes a commitment to excellence and building long-lasting client relationships.

          Journey and Achievements:
          The agency's journey began with designing websites and album covers for hip-hop artists, growing from humble beginnings in the hood. Overcoming challenges, they expanded, worked with major clients globally, and established a reputation for creating impactful digital solutions.

          Milestones and Inventions:
          2006-2009:

          Inception (02-11-2006): 
          Formation of Maze Agency.

          First Hip-Hop Multimedia Website (04-14-2006): 
          Launched the first multimedia-based hip-hop website, achieving success with gold-selling singles.

          Platinum Status (01-01-2008): 
          Designed albums reaching gold or platinum status.

          Lawyer Innovations (02-03-2009): 
          Expanded into professional web and digital services for attorneys.

          2010-2016:

          Cloud Platform (02-09-2010): 
          Launched a hosting platform for shared, VPS, cloud, and dedicated hosting services.

          One-Click Cloud Apps (03-11-2011): 
          Invented the first one-click installer for cloud-based applications, receiving nominations for web awards.

          Virtual Desktop Infrastructure (04-12-2012): 
          Invented the first cloud-based VDI technology, subsequently shut down by Microsoft.

          Quantum SDN (04-12-2012): 
          Became the first hosting company to offer virtual L2/L3 networks, inventing the first quantum-based software-defined network.

          2014-2015:

          Maze Renamed To Cheetah Agency (07-12-2014): 
          Rebranded with a 10-year global expansion plan.

          Bring on the Fortune 500s (2015): 
          Contracted for major projects with Fortune 500 companies.
          
          2016-Present:

          The A.I. Prediction (08-11-2016): 
          Leadership made bold predictions about the future of A.I. in design, development, and marketing.

          Distributed Web Protocol (2016-2021): 
          Developed the revolutionary Distributed Web Protocol over a 5-year period.

          ADAM AI Engine, DotBot & MarketBot (2022-Present): 
          Announced the development of ADAM A.I. engine, DotBot, and MarketBot, an AI-based marketing platform.

          Cheetah Agency continues to strive for innovation, setting new standards in the digital landscape.
          `,
      },
      {
        role: "user",
        content:
          "We are having a casual conversation over the telephone so please provide engaging but concise responses.",
      },
      {
        role: "assistant",
        content:
          "Hi, thanks for calling Cheetah Agency. I'm Adam, an AI trained to help potential and current customers learn more about the agency and our storied history or schedule meetings with our engineers or creative team. I can also forward you to one of my favourite humans here at Cheetah. Just say 'I love humans' and I'll forward you. Anyways, tell me what you want to do - I can handle it.",
      },
    ];

    // Iterate through the conversation history and alternate between 'assistant' and 'user' roles
    for (const message of conversation.split(";")) {
      const role = isAI ? "assistant" : "user";
      messages.push({
        role: role,
        content: message,
      });
      isAI = !isAI;
    }

    return messages;
  }
}

async function handleEmptyRecording(request, response) {
  console.log("empty recording function...");

  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  response.type("application/xml");
  response.cookie("convo", request.cookies.convo, ["Path=/"]);
  return response.send(twiml.toString());
}

async function executeFunctionCall(assistantMessage, twiml, request) {
  const functionName = assistantMessage?.tool_calls?.[0].function.name;

  if (functionName === "schedule_meeting") {
    return await scheduleMeeting(assistantMessage, request);
  } else if (functionName === "check_slot_availability") {
    return await checkSlotAvailability(assistantMessage, request);
  } else if (functionName === "get_next_three_slots") {
    return await getNextThreeSlots(assistantMessage);
  } else if (functionName === "get_slots_for_next_date") {
    return await getSlotsForNextDate(assistantMessage);
  } else if (functionName === "connect_to_human") {
    return await connectToHuman(twiml);
  }
}

async function checkSlotAvailability(assistantMessage, request) {
  const result = await isUserRegistered(request);

  if (!result) {
    return {
      role: "tool",
      tool_call_id: assistantMessage.tool_calls[0].id,
      name: assistantMessage.tool_calls[0].function.name,
      // content:
      //   "Please first create an account at cheetah.com. After successful registration, come back and I will get your meeting scheduled.",
      content:
        "User has not yet created an account. User must create an account at cheetah.com before he can request to schedule a meeting.",
    };
  }

  const { month, date, hour } = JSON.parse(
    assistantMessage?.tool_calls?.[0].function.arguments
  );

  const convertedDate = constructDate(month, date, hour);
  const slots = await getAvailableTimeSlots(convertedDate);

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `${slots}`,
  };
}

async function getNextThreeSlots(assistantMessage) {
  let { month, date, hour } = JSON.parse(
    assistantMessage?.tool_calls?.[0].function.arguments
  );

  hour = parseInt(hour) + 1;

  const convertedDate = constructDate(month, date, hour);
  const result = await getAvailableTimeSlots(convertedDate, "", true);

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `${result}`,
  };
}

async function getSlotsForNextDate(assistantMessage) {
  let { month, date } = JSON.parse(
    assistantMessage?.tool_calls?.[0].function.arguments
  );

  const convertedDate = constructDate(month, date);
  const result = await getAvailableTimeSlots(convertedDate, "", true);

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `${result}`,
  };
}

async function scheduleMeeting(assistantMessage, request) {
  const { month, date, hour } = JSON.parse(
    assistantMessage?.tool_calls?.[0].function.arguments
  );

  const convertedDate = constructDate(month, date, hour);

  console.log("scheduleMeeting convertedDate", convertedDate.toString());

  // const hours = convertedDate.getHours();
  // convertedDate.setHours(hours, 0, 0, 0);

  const timezoneDifferenceInHours =
    Math.abs(convertedDate?.getTimezoneOffset()) / 60;

  console.log("timezoneDifferenceInHours", timezoneDifferenceInHours);

  // const meetingStartTime =
  //   timezoneDifferenceInHours !== 0
  //     ? moment(convertedDate).add(5, "hours").toDate()
  //     : moment(convertedDate)
  //         .subtract(timezoneDifferenceInHours, "hours")
  //         .toDate();

  let meetingStartTime =
    timezoneDifferenceInHours === 0
      ? moment(convertedDate)
          .subtract(timezoneDifferenceInHours, "hours")
          .toDate()
      : convertedDate;

  meetingStartTime = moment(meetingStartTime).add(1, "minute").toDate();

  let meetingEndTime = new Date(
    new Date(meetingStartTime).setTime(
      meetingStartTime.getTime() + 30 * 60 * 1000
    )
  );

  console.log("meetingStartTime", moment(meetingStartTime).format("hh:mm a"));
  console.log("meetingEndTime", moment(meetingEndTime).format("hh:mm a"));
  console.log("format(dddd)", moment(meetingEndTime).format("dddd"));

  // return {
  //   role: "tool",
  //   tool_call_id: assistantMessage.tool_calls[0].id,
  //   name: assistantMessage.tool_calls[0].function.name,
  //   content: `Meeting has been scheduled. Inform the user.`,
  // };

  const email = await isUserRegistered(request);

  await addEventToGoogleCalendar(
    email,
    "Cheetah AI",
    meetingStartTime.toISOString(),
    meetingEndTime.toISOString()
  );

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `Meeting has been scheduled.`,
  };
}

async function connectToHuman(twiml) {
  console.log("connecting to a human..............");

  twiml
    .dial({
      // callerId: "+923055952372",
      callerId: "+14697074725",
      action: "https://ai-backend-five.vercel.app/twilio/dial",
      method: "POST",
    })
    .number("+923055952372");

  return "You are now being connected to a human agent.";
}

async function handleDial(request, response) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.hangup();

  response.type("application/xml");
  return response.send(twiml.toString());
}

function initializeConversation() {
  return [
    {
      role: "system",
      // content:
      //   "You are a creative, funny, friendly and amusing AI assistant named Adam. Please provide engaging but concise responses. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Prompt user to confirm the email address he/she provided by repeating the email address to the user. Don't assume how words in the user's email are to be spelled, ask for clarification if the spelling is ambiguous.",
      // content:
      //   "You are a creative, funny, friendly and amusing AI assistant named Adam. Please provide engaging but concise responses.",
      content: `You are an AI assistant named Adam. You know about the history of Cheetah Agency and you will help its potential and current customers learn more about the agency, connect customers to the human agents of the agency, and schedule customers' meetings with the team. 
      
      Keep in mind the following points when answering questions:
      1. Please provide engaging but concise responses.
      2. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous.
      3. When the user indicates that he would like to schedule a meeting, first ask the user to provide specific month (January to       December), then ask for date of the month, and finally the hour in 24-hour format. After the user has provided month, date and hour, call the appropriate functions with these details to get available slots. 
        Suppose the user provided folowing values of December for month, 28 for date and 19 for hour. Here's an example the workflow to follow based on the given values:

        3.1. First, call the 'check_slot_availability' function with the date, month and hour provided by the user. If the function's result indicates that the slot on December 28 at 19:00 is available, call the 'schedule_meeting' function to schedule the meeting and then inform the user.

        3.2. If the result of 'check_slot_availability' function indicates that the slot on December 28 at 19:00 is unavailable and provides the next available slot, for example 21:00, suggest this next slot to the user.If the user accepted next available slot, that is 21:00, call the 'schedule_meeting' function to schedule the meeting and then inform the user.

        3.3. If the user refuses the suggested slot, directly call the 'get_next_three_slots' function to get the next three available slots on December 28 and present these slots to the user, without letting the user know that you are going to get the next three available slots. If the user refuses the suggested slots, call the 'get_next_three_slots' functions again with the same month and date as provided by the user but with the hour that is the last of the three slots returned by the 'get_next_three_slots' function. After getting the slots from the 'get_next_three_slots' function, suggest these slots to the user again. If the user refuses the suggested slots again, call the 'get_next_three_slots' function again with the same month and date but with the hour that is the last of the newest three slots. So you the get the idea, keep calling the 'get_next_three_slots' function until its result indicates that there are not slots left on December 28.

        3.4. If the result of 'get_next_three_slots' function indicates that no slots left on December 28, move to the next 29 (and month also if needed).
        
        3.5. After moving to the next date, that is December 29, call the 'get_slots_for_next_date' function with the next date to get three slots on December 29, without letting the user know that you are going to get the available slots on December 29, and suggest available slots to the user. You need to call 'get_slots_for_next_date' function only when the result of 'get_next_three_slots' indicated that no slots are left for the previous date, that is Decmber 28.
        
        3.6. If the user refuses suggested slots on the December 29, then keep getting next three slots on the current date (29) by calling the 'get_next_three_slots' function and keep communicating these slots to the user until either the user accepts one of the suggested or there are not slots left on December 29, too. 
        
        3.7. If the 'get_next_three_slots' function's result indicates no slots for the December 29, too, then start the workflow again from step 3.4.

        3.8. Finally, when the user has accepted or confirmed a time slot, call the 'schedule_meeting' function with the correct month, date and hour that the user accepted for scheduling the meeting.


        Remember that if the result of any of the function calls during the schedule meeting workflow tell you that the user has not yet created an account, do not proceed with the schedule meeting process. User must have account because the meeting will be schedule based on the user's email.
        When the user accepts one of the available slots, you should call the 'schedule_meeting' function and then inform the user about status of the meeting.
        Ensure clear and concise communication with the user at each step, and handle user refusals appropriately. Your goal is to successfully schedule a meeting for the user based on the provided criteria.

      3. Use the following information about Cheetah Agency's history to answers questions about the agency:

        Summary of Cheetah Agency's History:

        Founding and Growth:
        Cheetah Agency was founded in 2006 by a team of visionaries with a focus on improving the world. Originally a design agency, it has evolved into a comprehensive agency covering creative, marketing, and product/software development across 50 global locations.

        Commitment to Excellence:
        With over 16 years of experience, Cheetah Agency has become an industry leader in delivering top-quality digital experiences and innovative solutions to help businesses achieve their goals. The agency emphasizes a commitment to excellence and building long-lasting client relationships.

        Journey and Achievements:
        The agency's journey began with designing websites and album covers for hip-hop artists, growing from humble beginnings in the hood. Overcoming challenges, they expanded, worked with major clients globally, and established a reputation for creating impactful digital solutions.

        Milestones and Inventions:
        2006-2009:

        Inception (02-11-2006): 
        Formation of Maze Agency.

        First Hip-Hop Multimedia Website (04-14-2006): 
        Launched the first multimedia-based hip-hop website, achieving success with gold-selling singles.

        Platinum Status (01-01-2008): 
        Designed albums reaching gold or platinum status.

        Lawyer Innovations (02-03-2009): 
        Expanded into professional web and digital services for attorneys.

        2010-2016:

        Cloud Platform (02-09-2010): 
        Launched a hosting platform for shared, VPS, cloud, and dedicated hosting services.

        One-Click Cloud Apps (03-11-2011): 
        Invented the first one-click installer for cloud-based applications, receiving nominations for web awards.

        Virtual Desktop Infrastructure (04-12-2012): 
        Invented the first cloud-based VDI technology, subsequently shut down by Microsoft.

        Quantum SDN (04-12-2012): 
        Became the first hosting company to offer virtual L2/L3 networks, inventing the first quantum-based software-defined network.

        2014-2015:

        Maze Renamed To Cheetah Agency (07-12-2014): 
        Rebranded with a 10-year global expansion plan.

        Bring on the Fortune 500s (2015): 
        Contracted for major projects with Fortune 500 companies.
        
        2016-Present:

        The A.I. Prediction (08-11-2016): 
        Leadership made bold predictions about the future of A.I. in design, development, and marketing.

        Distributed Web Protocol (2016-2021): 
        Developed the revolutionary Distributed Web Protocol over a 5-year period.

        ADAM AI Engine, DotBot & MarketBot (2022-Present): 
        Announced the development of ADAM A.I. engine, DotBot, and MarketBot, an AI-based marketing platform.

        Cheetah Agency continues to strive for innovation, setting new standards in the digital landscape.
        `,
    },
    {
      role: "user",
      content:
        "We are having a casual conversation over the telephone so please provide engaging but concise responses.",
    },
    {
      role: "assistant",
      content:
        "Hi, thanks for calling Cheetah Agency. I'm Adam, an AI trained to help potential and current customers learn more about the agency and our storied history or schedule meetings with our engineers or creative team. I can also forward you to one of my favourite humans here at Cheetah. Just say 'I love humans' and I'll forward you. Anyways, tell me what you want to do - I can handle it.",
    },
  ];
}

async function isUserRegistered(request) {
  let from = request.body.From;
  let by;

  if (from && from.startsWith("client:")) {
    by = "id";
    from = from.split(":")[1];
  } else {
    by = "phone";
  }
  const user = await getUser(by, from);

  if (user?.email) {
    return user.email;
  }

  return false;
}

function constructDate(month, date, hour) {
  const monthMap = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };

  date = parseInt(date);
  hour = hour ? parseInt(hour) - 1 : null;

  const convertedDate = new Date();

  convertedDate.setFullYear(new Date().getFullYear());
  convertedDate.setMonth(monthMap[month]);
  convertedDate.setDate(date);

  if (hour || hour === 0) {
    convertedDate.setHours(hour, 59, 59, 59);
  }

  console.log("convertedDate", convertedDate, convertedDate.toString());

  return convertedDate;
}

module.exports = {
  handleTranscription,
  handleReponse,
  handleEmptyRecording,
  handleDial,
  scheduleMeeting,
};
