const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWIML_APP_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const BASE_URL = process.env.BASE_URL;

const twilio = require("twilio");
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const uuid = require("uuid");
const { addConversation } = require("../datastore");

async function buyPhoneNumber() {
  const availableNumbers = await client
    .availablePhoneNumbers("US")
    .local.list();

  const phoneNumberToPurchase = availableNumbers[0].phoneNumber;

  //   const purchasedNumber = await client.incomingPhoneNumbers.create({
  //     phoneNumber: phoneNumberToPurchase,
  //     friendlyName: "My Twilio Number",
  //   });

  //   console.log("purchasedNumber.sid", purchasedNumber.sid);
  console.log("available numbers", availableNumbers);
}

async function addVerifiedCallerId(phoneNumber) {
  const validationRequest = await client.validationRequests.create({
    friendlyName: "My Home Phone Number 2",
    phoneNumber: "+923055952372",
    // phoneNumber: "+923141560434",
  });

  const message = `Your 6-digit verification code is: ${validationRequest.validationCode}`;
  await sendSMS(phoneNumber, message);

  console.log("validationCode=====", validationRequest.validationCode);
}

async function sendSMS(phoneNumber, body) {
  const message = await client.messages.create({
    body,
    messagingServiceSid: MESSAGING_SERVICE_SID,
    to: phoneNumber,
  });

  console.log("message.sid=====", message.sid);
}

function getTwilioAccessToken(userId) {
  if (!userId) {
    userId = uuid.v4();
  }

  const accessToken = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
    identity: userId,
  });

  const grant = new VoiceGrant({
    outgoingApplicationSid: TWIML_APP_SID,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);
  console.log("access token: ", accessToken);

  const result = {
    token: accessToken.toJwt(),
    userId,
  };

  return result;
}

async function createVerification(phoneNumber) {
  try {
    const verification = await client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
      });

    console.log("Verification code sent:", verification.sid);
    return "Verification code sent.";
  } catch (error) {
    console.error("Error sending verification code:", error.message);
  }
}

async function checkVerification(code, phoneNumber) {
  let isVerified = false;

  try {
    const verificationCheck = await client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    if (verificationCheck.status === "approved") {
      isVerified = true;
    }
  } catch (error) {
    console.error("Error checking verification code:", error.message);
  }

  return isVerified;
}

function getCallerIdFromRequest(request) {
  const from = request.body.From;

  if (from?.startsWith("client:")) {
    return from.split(":")[1];
  }

  return from;
}

function isPhoneCall(request) {
  const from = request.body.From;
  return from?.startsWith("client:") ? false : true;
}

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();


  // const customerPhone

  // First, get information about the customer to which this caller belongs. Information such as greeting message, goodbye message url and any other information that will be required during the call. Set all this information in cookies.

  // Identify saas customer based on the current caller, that is based on 'From' value.
  // Get customerId, company information and history, greeting and goodbye messages urls and set in cookies.

  // get user by the 'From' value, either phone number or callerId, from the database.
  const isRegistered = true;
  const companyHistory = "";
  const greetingMessageUrl = "";
  const goodbyeMessageUrl = "";

  const callerId = getCallerIdFromRequest(request);
  const conversation = initializeConversation(
    isPhoneCall(request),
    companyHistory
  );

  addConversation(callerId, conversation);

  twiml.play(`${BASE_URL}/public/greeting-message-michael.mp3`); // get this url from database based

  twiml.gather({
    speechTimeout: "auto",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/twilio/respond`,
    actionOnEmptyResult: true,
  });

  return {
    cookie: JSON.stringify({
      isUserRegistered: isRegistered,
      greetingMessageUrl: "",
      goodbyeMessageUrl: "",
    }),
    data: twiml.toString(),
  };
}

async function gatherSpeechInput() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.gather({
    speechTimeout: "auto",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/twilio/respond`,
    actionOnEmptyResult: true,
  });

  return twiml.toString();
}

async function handleSpeechInput(request, response) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  let voiceInput = request.body.SpeechResult;
  const callerId = getCallerIdFromRequest(request);

  console.log("voice input", voiceInput);

  if (!voiceInput) {
    twiml.play(`${BASE_URL}/public/goodbye-message-michael.mp3`);
    twiml.hangup();

    return twiml.toString();
  }

  let conversation = getConversationByUserId(callerId);

  if (!conversation) {
    conversation = initializeConversation(isPhoneCall());
    addConversation(callerId, conversation);
  }

  conversation.push({ role: "user", content: `${voiceInput}` });

  console.log("conversation - before", conversation);

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

  // twiml.say(
  //   {
  //     voice: "Google.en-US-Neural2-D",
  //   },
  //   cleanedAiResponse
  // );

  if (connectToHuman === true) {
    twiml
      .dial({
        callerId: "+923055952372",
        action: "https://62a1-119-73-99-27.ngrok-free.app/twilio/dial",
        method: "POST",
      })
      .number("+923055952372");
  } else {
    // Redirect to the Function where the <Gather> is capturing the caller's speech
    twiml.redirect(
      {
        method: "POST",
      },
      `https://62a1-119-73-99-27.ngrok-free.app/twilio/transcribe`
    );
  }

  response.type("application/xml");
  updateConversation(callerId, conversation);

  return response.send(twiml.toString());

  async function generateAIResponse(conversation) {
    return await createChatCompletion(conversation);
  }

  async function createChatCompletion(messages) {
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

              projectType: {
                type: "string",
                enum: ["Creative", "Technical", "Marketing"],
                description:
                  "The type of project about which the user would like to discuss in the scheduled meeting.",
              },
            },
            required: ["month", "date", "hour", "projectType"],
          },
        },
      },

      {
        type: "function",
        function: {
          name: "is_user_registered",
          description:
            "Check if the user has created an account with Cheetah Agency.",
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

    if (!request.body.From.startsWith("client:"))
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

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        // model: "gpt-4",
        tools,
        messages: messages,
        temperature: 0.8,
        // max_tokens: 100,
        max_tokens: 50,
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
        return assistantMessage?.tool_calls?.[0].function.name;
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

module.exports = {
  addVerifiedCallerId,
  buyPhoneNumber,
  getTwilioAccessToken,
  createVerification,
  checkVerification,
  sendSMS,
  handleIncomingCall,
  gatherSpeechInput,
  handleSpeechInput,
};
