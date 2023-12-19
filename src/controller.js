const Twilio = require("twilio");
const { OpenAI } = require("openai");
const { convertTextToSpeech } = require("./text-to-speech");
const { convertSpeechToText } = require("./speech-to-text");
const { getAvailableTimeSlots } = require("./calendly");
const { getUserById, getUser } = require("./firestore");

// const OPENAI_API_KEY = "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"; // personal account

// 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

const OPENAI_API_KEY = "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"; // cheetah account

async function handleTranscription(request, response) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (!request.cookies.convo) {
    console.log("saying introduction....");

    // https://ai-backend-five.vercel.app

    twiml.play(
      "https://ac11-119-73-99-27.ngrok.io/public/greeting-message-michael.mp3"
    );
  }

  twiml.gather({
    speechTimeout: 2,
    speechModel: "experimental_conversations",
    input: "speech",
    action: "https://ac11-119-73-99-27.ngrok.io/twilio/respond",
    actionOnEmptyResult: true,
  });

  response.type("application/xml");

  if (!request.cookies.convo) {
    console.log("No cookies.......", request.cookies.convo);
    response.cookie("convo", "", ["Path=/"]);
  }

  return response.send(twiml.toString());
}

async function handleReponse(request, response) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const cookieValue = request.cookies.convo;
  const cookieData = cookieValue
    ? JSON.parse(decodeURIComponent(cookieValue))
    : null;

  console.log("cookieValue", cookieValue);

  console.log("cookieData", cookieData);

  let voiceInput = request.body.SpeechResult;

  console.log("voice input", voiceInput);

  if (!voiceInput) {
    // twiml.say("It's been a pleasure assisting you. Goodbye!");
    twiml.play(
      "https://ac11-119-73-99-27.ngrok.io/public/goodbye-message-michael.mp3"
    );

    twiml.hangup();

    response.type("application/xml");
    return response.send(twiml.toString());
  }

  let conversation = [];

  if (cookieData?.conversation) {
    // conversation = cookieData.conversation.map((item) => {
    //   item = item.split(":");

    //   return {
    //     role: item[0],
    //     content: item[1],
    //   };
    // });

    conversation = cookieData.conversation;
  }
  conversation = [...initializeConversation(), ...conversation];

  conversation.push({ role: "user", content: `${voiceInput}` });

  // let aiResponse = await generateAIResponse(conversation.join(";"));
  let aiResponse = await generateAIResponse(conversation);

  if (aiResponse?.role === "tool") {
    conversation.push(aiResponse);

    console.log("tool...");
    console.log(conversation);

    aiResponse = await generateAIResponse(conversation);
  }

  let connectToHuman = false;

  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
    connectToHuman = true;
  }

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

  conversation.push({ role: "assistant", content: `${aiResponse}` });
  // conversation.push(`${aiResponse}`);

  console.log("conversation - after", conversation);

  while (conversation.length > 20) {
    conversation.shift();
  }

  const textToSpeechFileURL = await convertTextToSpeech(cleanedAiResponse);

  console.log("cleanedAiResponse", cleanedAiResponse);
  console.log("textToSpeechFileURL", textToSpeechFileURL);

  twiml.play(textToSpeechFileURL);
  // twiml.play(
  //   "https://ac11-119-73-99-27.ngrok.io/public/greeting-message-michael.mp3"
  // );

  console.log("play");

  if (connectToHuman === true) {
    twiml
      .dial({
        callerId: "+923055952372",
        action: "https://ac11-119-73-99-27.ngrok.io/twilio/dial",
        method: "POST",
      })
      .number("+923055952372");
  } else {
    // Redirect to the Function where the <Gather> is capturing the caller's speech
    console.log("redirect");
    twiml.redirect(
      {
        method: "POST",
      },
      `https://ac11-119-73-99-27.ngrok.io/twilio/transcribe`
    );
  }

  console.log("preparing response");

  response.type("application/xml");

  conversation.splice(0, 3);

  const newCookieValue = encodeURIComponent(
    JSON.stringify({
      // conversation: conversation?.map((obj) => `${obj.role}:${obj.content}`),
      conversation,
    })
  );

  response.cookie("convo", newCookieValue);

  console.log("response returned...");

  return response.send(twiml.toString());

  // Function to generate the AI response based on the conversation history
  async function generateAIResponse(conversation) {
    // const messages = formatConversation(conversation);
    // return await createChatCompletion(messages);
    // console.log("conversation-------", conversation);
    // return;
    return await createChatCompletion(conversation);
  }

  // Function to create a chat completion using the OpenAI API
  async function createChatCompletion(messages) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        // model: "gpt-3.5-turbo-1106",
        tools: [
          {
            type: "function",
            function: {
              name: "schedule_meeting",
              description:
                "Schedule meeting with a human because user wants to discuss further with a human in a scheduled meeting.",
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
              name: "get_next_three_slots",
              description:
                "The user declined your request to schedule meeting on the slot that you communicated as the next available slot, that is next to the one the user originally requested. The slot that you communicated was available but the user refused to schedule meeting on that slot.",
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
                "No time slots are left on the date you currently provided so now ",
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
                      "The month in which the user would like to get his/her meeting scheduled.",
                  },

                  date: {
                    type: "number",
                    enum: Array.from({ length: 31 }, (_, index) => index + 1),
                    description:
                      "The date next to the one that you previously provided for checking time slots available",
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
        temperature: 0.8, // Controls the randomness of the generated responses. Higher values (e.g., 1.0) make the output more random and creative, while lower values (e.g., 0.2) make it more focused and deterministic. You can adjust the temperature based on your desired level of creativity and exploration.
        max_tokens: 100, //You can adjust this number to control the length of the generated responses. Keep in mind that setting max_tokens too low might result in responses that are cut off and don't make sense.
        // top_p: 0.9, Set the top_p value to around 0.9 to keep the generated responses focused on the most probable tokens without completely eliminating creativity. Adjust the value based on the desired level of exploration.
        // n: 1, Specifies the number of completions you want the model to generate. Generating multiple completions will increase the time it takes to receive the responses.
      });

      const assistantMessage = completion.choices[0].message;

      const shouldCallFunction =
        (assistantMessage.content === null || !assistantMessage.content) &&
        assistantMessage?.tool_calls?.length > 0;

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
      // Check if the error is a timeout error
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

  // Function to format the conversation history into a format that the OpenAI API can understand
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
  }

  if (functionName === "get_next_three_slots") {
    return await getNextThreeSlots(assistantMessage);
  }

  if (functionName === "connect_to_human") {
    return await connectToHuman(twiml);
  }
}

async function scheduleMeeting(assistantMessage, request) {
  args = JSON.parse(assistantMessage?.tool_calls?.[0].function.arguments);

  console.log("args.month", args.month);
  console.log("args.date", args.date);
  console.log("args.hour", args.hour);

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

  let { month, date, hour } = args;

  date = parseInt(date);
  hour = parseInt(hour);

  const convertedDate = new Date();

  convertedDate.setFullYear(new Date().getFullYear()); // Set the current year
  convertedDate.setMonth(monthMap[month]); // Set the month
  convertedDate.setDate(date);
  // convertedDate.setHours(hour - 1, 59, 59, 59);
  convertedDate.setHours(hour, 30);

  console.log("convertedDate", convertedDate, convertedDate.toString());

  // return "Please first create an account at cheetah.com. After successful registration, come back and I will get your meeting scheduled.";

  // let from = request.body.From;

  // let by;

  // if (from && from.startsWith("client:")) {
  //   by = "id";
  //   from = from.split(":")[1];
  // } else {
  //   by = "phone";
  // }

  // const user = await getUser(by, from);

  // if (!user?.email) {
  //   return "Please first create an account at cheetah.com. After successful registration, come back and I will get your meeting scheduled.";
  // }

  // const { day, time } = await getAvailableTimeSlots(new Date(), user.email);
  const slots = await getAvailableTimeSlots(convertedDate, "");

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `${slots}`,
  };

  return `Your meeting has been scheduled for ${day} at ${time}.`;
}

async function connectToHuman(twiml) {
  console.log("connecting to a human..............");

  twiml
    .dial({
      // callerId: "+923055952372",
      callerId: "+14697074725",
      action: "https://ac11-119-73-99-27.ngrok.io/twilio/dial",
      method: "POST",
    })
    .number("+923055952372");

  return "You are now being connected to a human agent.";
}

async function getNextThreeSlots(assistantMessage) {
  let args = JSON.parse(assistantMessage?.tool_calls?.[0].function.arguments);

  console.log("getNextThreeSlots", args);

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

  let { month, date, hour } = args;

  const convertedDate = new Date();

  convertedDate.setFullYear(new Date().getFullYear());
  convertedDate.setMonth(monthMap[month]);
  convertedDate.setDate(date);
  convertedDate.setHours(hour - 1, 59, 59, 59);
  // convertedDate.setHours(hour);

  console.log("convertedDate", convertedDate, convertedDate.toString());

  const result = await getAvailableTimeSlots(convertedDate, "", true);

  return {
    role: "tool",
    tool_call_id: assistantMessage.tool_calls[0].id,
    name: assistantMessage.tool_calls[0].function.name,
    content: `${result}`,
  };
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
      content: `You are a creative, funny, friendly and amusing AI assistant named Adam. You also know about the history of Cheetah Agency and you will help its potential and current customers learn more about the agency. 
      
      Keep in mind the following points when answering questions:
      1. Please provide engaging but concise responses. 
      2. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous.
      3. When user indicates that he would like to schedule a meeting, ask for specific month (January to December), date of the month, and the specific hour in 24-hour format separately. Ask user to first provide the month, then ask for date and finally ask for hour. Month, date and hour all are required from the user. Make sure that the user provides a date in future. Consider following scenarios:
          - For example, the user asked to schedule meeting on 28 December at 19.
          - Case 1: Slot is available. Schedule the meeting.
          - Case 2: Slot is not available. Communicate one next slot to the user. If user accepts the slot, then schedule the meeting otherwise get next three available slots and communicate it to the user and keep getting and communicating next three slots until you are told that no slots for the given date are left
          - Case 3: If no slots are left for the given date, increment the date and and try getting available slots for the new date and keep communicating available slots for that date.
          
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
}

module.exports = {
  handleTranscription,
  handleReponse,
  handleEmptyRecording,
  handleDial,
  scheduleMeeting,
};
