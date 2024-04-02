const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWIML_APP_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;

const twilio = require("twilio");
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const uuid = require("uuid");

const {
  storeCallData,
  getCallData,
  updateCallConversation,
  deleteCallData,
} = require("../integrations/redis");
const {
  generateAIResponse,
  initializeConversation,
} = require("./ai-model.controller");

const Customer = require("../../models/customer");
const Assistant = require("../../models/assistant");
const CompanyHistory = require("../../models/companyHistory");
const Integration = require("../../models/integration");
const { convertTextToSpeech } = require("../integrations/textToSpeech");
const { uploadToS3 } = require("../integrations/s3Storage");
const User = require("../../models/user");
const MeetingEvent = require("../../models/meetingEvent");

async function createVerifyService(companyName) {
  try {
    const service = await client.verify.v2.services.create({
      friendlyName: companyName,
      codeLength: 4,
    });

    console.log("Verify service created - sid", service.sid);
    return service.sid;
  } catch (error) {
    console.error("Error sending verification code:", error.message);
  }
}

async function buyPhoneNumber() {
  const availableNumbers = await client
    .availablePhoneNumbers("US")
    .local.list();

  console.log("number to purchase", availableNumbers?.[0]?.phoneNumber);

  // const phoneNumberToPurchase = availableNumbers[0].phoneNumber;

  // const purchasedNumber = await client.incomingPhoneNumbers.create({
  //   phoneNumber: phoneNumberToPurchase,
  //   friendlyName: "My Twilio Number",
  // });

  // console.log("purchasedNumber.phoneNumber", purchasedNumber.phoneNumber);

  // return purchasedNumber.phoneNumber;

  return "+14697074725";
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

async function createVerification(phoneNumber, verifyServiceId) {
  try {
    const verification = await client.verify.v2
      .services(verifyServiceId)
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

function checkIsPhoneCall(request) {
  const from = request.body.From;
  return from?.startsWith("client:") ? false : true;
}

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const callerId = getCallerIdFromRequest(request);
  const isPhoneCall = checkIsPhoneCall(request);

  const customerId = request.body.customerId;
  const customerPhoneNumber = request.body.To;

  let customer;

  if (customerId) {
    customer = await Customer.findByPk(customerId);
  } else {
    customer = await Customer.findOne({
      where: { twilioNumber: customerPhoneNumber },
    });
  }

  let assistant = await Assistant.findOne({
    where: {
      customerId: customer.id,
    },
  });

  let history = await CompanyHistory.findAll({
    where: {
      customerId: customer.id,
    },
  });

  let oauthCredentials = await Integration.findOne({
    where: {
      customerId: customer.id,
    },
  });

  let meetingEvent = await MeetingEvent.findOne({
    where: {
      customerId: customer.id,
    },
  });

  customer = customer?.toJSON();
  assistant = assistant?.toJSON();
  history = history.map((item) => item.toJSON());
  oauthCredentials = oauthCredentials?.toJSON();
  meetingEvent = meetingEvent?.toJSON();

  const formattedHistory = history
    .map((entry) => `${entry.section}:\n${entry.content}`)
    .join("\n\n");

  let user;
  if (isPhoneCall) {
    user = await User.findOne({
      where: {
        phoneNumber: callerId,
      },
    });
  } else {
    user = await User.findOne({
      where: {
        callerId,
      },
    });
  }

  user = user?.toJSON();

  const conversation = initializeConversation(
    isPhoneCall,
    assistant.name,
    customer.companyName,
    formattedHistory
  );

  storeCallData(callerId, {
    modelName: assistant.name,
    companyHistory: formattedHistory,
    companyName: customer.companyName,
    conversation,
    customerId: customer.id,
    customerEmail: customer.email,
    isUserRegistered: user ? true : false,
    userEmail: user?.email,
    greetingMessageUrl: assistant.greetingMessageUrl,
    farewellMessageUrl: assistant.farewellMessageUrl,
    phoneNumbers: customer.phoneNumbers,
    oauthCredentials,
    voice: assistant.voice,
    meetingEvent,
  });

  twiml.play(assistant.greetingMessageUrl);

  twiml.gather({
    speechTimeout: "auto",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/twilio/speech-input`,
    actionOnEmptyResult: true,
  });

  return twiml.toString();
}

async function gatherSpeechInput() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.gather({
    speechTimeout: "auto",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/twilio/speech-input`,
    actionOnEmptyResult: true,
  });

  return twiml.toString();
}

async function handleSpeechInput(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const isPhoneCall = checkIsPhoneCall(request);
  const callerId = getCallerIdFromRequest(request);
  const voiceInput = request.body.SpeechResult;
  console.log("voice input", voiceInput);

  const callData = await getCallData(callerId);

  let {
    farewellMessageUrl,
    conversation,
    phoneNumbers,
    companyHistory,
    companyName,
    modelName,
    voice,
    customerId,
  } = callData;

  if (!voiceInput) {
    twiml.play(farewellMessageUrl);
    twiml.hangup();

    deleteCallData(callerId);

    return twiml.toString();
  }

  if (!conversation) {
    conversation = initializeConversation(
      isPhoneCall,
      modelName,
      companyName,
      companyHistory
    );

    callData.conversation = conversation;
    updateCallConversation(callerId, callData);
  }

  conversation.push({ role: "user", content: `${voiceInput}` });
  let aiResponse = await generateAIResponse(
    isPhoneCall,
    conversation,
    callData
  );

  while (aiResponse?.role === "tool") {
    conversation.push(aiResponse);
    aiResponse = await generateAIResponse(isPhoneCall, conversation, callData);
  }

  console.log("aiResponse", aiResponse);

  let shouldRedirectCall = false;
  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
    shouldRedirectCall = true;
  }

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();
  conversation.push({ role: "assistant", content: `${aiResponse}` });

  while (conversation.length > 20) {
    conversation.shift();
  }

  const generatedSpeechFile = await convertTextToSpeech(
    cleanedAiResponse,
    voice
  );

  const textToSpeechFileURL = await uploadToS3(generatedSpeechFile, customerId);

  console.log("cleanedAiResponse", cleanedAiResponse);
  console.log("textToSpeechFileURL", textToSpeechFileURL);

  twiml.play(textToSpeechFileURL);

  if (shouldRedirectCall && phoneNumbers.length > 0) {
    console.log("Dialing the human agent's number...");

    twiml
      .dial({
        callerId: phoneNumbers[0],
        action: `${BASE_URL}/twilio/redirected-call-disconnect`,
        method: "POST",
      })
      .number(phoneNumbers[0]);
  } else {
    console.log("redirect true - gather -speech");

    twiml.redirect(
      {
        method: "POST",
      },
      `${BASE_URL}/twilio/gather-speech`
    );
  }

  callData.conversation = conversation;
  updateCallConversation(callerId, callData);

  return twiml.toString();
}

function disconnectRedirectedCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const callerId = getCallerIdFromRequest(request);

  twiml.hangup();

  deleteCallData(callerId);

  return twiml.toString();
}

function handleCallDisconnect(request) {
  const callerId = getCallerIdFromRequest(request);
  deleteCallData(callerId);
}

module.exports = {
  createVerifyService,
  addVerifiedCallerId,
  buyPhoneNumber,
  getTwilioAccessToken,
  createVerification,
  checkVerification,
  sendSMS,
  handleIncomingCall,
  gatherSpeechInput,
  handleSpeechInput,
  handleCallDisconnect,
  disconnectRedirectedCall,
};
