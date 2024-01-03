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

const {
  storeCallData,
  getCallData,
  updateCallConversation,
  deleteCallData,
} = require("../redis");
const {
  generateAIResponse,
  initializeConversation,
} = require("./ai-model.controller");
const Customer = require("../models/customer.model");
const Assistant = require("../models/assistant.model");
const CompanyHistory = require("../models/companyHistory.model");
const OAuthCredentials = require("../models/credential.model");
const { convertTextToSpeech } = require("../text-to-speech");
const { uploadToS3 } = require("../s3-storage");

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

function checkIsPhoneCall(request) {
  const from = request.body.From;
  return from?.startsWith("client:") ? false : true;
}

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

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

  let oauthCredentials = await OAuthCredentials.findOne({
    where: {
      customerId: customer.id,
    },
  });

  customer = customer.toJSON();
  assistant = assistant.toJSON();
  history = history.map((item) => item.toJSON());
  oauthCredentials = oauthCredentials.toJSON();

  const formattedHistory = history
    .map((entry) => `${entry.section}:\n${entry.content}`)
    .join("\n\n");

  console.log("formattedHistory", formattedHistory);

  // get user by the 'From' value, either phone number or callerId, from the database.
  const isRegistered = true;

  const callerId = getCallerIdFromRequest(request);
  const conversation = initializeConversation(
    checkIsPhoneCall(request),
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
    isUserRegistered: isRegistered,
    greetingMessageUrl: assistant.greetingMessageUrl,
    farewellMessageUrl: assistant.farewellMessageUrl,
    phoneNumbers: customer.phoneNumbers,
    oauthCredentials,
    voice: assistant.voice,
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
    updateCallConversation(callerId, conversation);
  }

  conversation.push({ role: "user", content: `${voiceInput}` });
  let aiResponse = await generateAIResponse(isPhoneCall, conversation);

  while (aiResponse?.role === "tool") {
    conversation.push(aiResponse);
    aiResponse = await generateAIResponse(isPhoneCall, conversation);
  }

  console.log("aiResponse", aiResponse);

  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
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

  if (aiResponse === "connect_to_human" && phoneNumbers?.length > 0) {
    twiml
      .dial({
        callerId: phoneNumbers[0],
        action: `${BASE_URL}/twilio/dial`,
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
  updateCallConversation(callerId, conversation);

  return twiml.toString();
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
