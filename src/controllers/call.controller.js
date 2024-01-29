const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWIML_APP_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;

const path = require("path");
const fs = require("fs");

const twilio = require("twilio");

const { getContactByPhoneNumber } = require("../integrations/hubspotCRM");

const {
  generateCallAnsweringAgentResponse,
} = require("./callAnsweringAgent.controller");

const {
  deleteCallData,
  storeCallData,
  getCallData,
} = require("../integrations/redis");
const { uploadToS3 } = require("../integrations/s3Storage");
const { convertTextToSpeech } = require("../integrations/textToSpeech");
const { formatHubSpotContactDetails } = require("../utils/formatters");

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const customerPhoneNumber = request.body.customerPhoneNumber;
  const businessPhoneNumber = request.body.To;
  const callId = request.body.CallSid;

  let businessDetails = {
    businessName: "Cheetah",
    businessEmail: "hammad@ccript.com",
    phoneNumbers: [],
    businessPhoneNumber,
    voice: "Bill",
    greetingMessageUrl:
      "https://psychix.s3.amazonaws.com/ai-bot/customer-2/greetingMessage.mp3",
    farewellMessageUrl:
      "https://psychix.s3.amazonaws.com/ai-bot/customer-2/farewellMessage.mp3",
    assistantName: "Adam",
  };

  const filePath = path.join(__dirname, "token.json");
  const token = fs.readFileSync(filePath, { encoding: "utf-8" });
  const { accessToken, refreshToken, expirationTime } = JSON.parse(token);

  const contact = await getContactByPhoneNumber(
    accessToken,
    refreshToken,
    expirationTime,
    customerPhoneNumber
  );

  const formattedCustomerDetails = contact
    ? formatHubSpotContactDetails(contact)
    : "";

  //   const conversation = initializeConversation(formattedCustomerDetails);

  storeCallData(customerPhoneNumber, {
    ...businessDetails,
    customerDetails: formattedCustomerDetails,
    customerName: contact
      ? `${contact.properties.firstname} ${contact.properties.lastname}`
      : "",

    callId,
  });

  twiml.play(businessDetails.greetingMessageUrl);

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

  const { customerPhoneNumber } = request.body;

  const voiceInput = request.body.SpeechResult;
  console.log("voice input", voiceInput);

  const callData = await getCallData(customerPhoneNumber);

  let {
    farewellMessageUrl,
    phoneNumbers,
    businessName,
    customerName,
    assistantName,
    customerDetails,
    voice,
    callId,
  } = callData;

  if (!voiceInput) {
    twiml.play(farewellMessageUrl);
    twiml.hangup();

    deleteCallData(customerPhoneNumber);

    return twiml.toString();
  }

  let aiResponse = await generateCallAnsweringAgentResponse(
    voiceInput,
    businessName,
    customerName,
    assistantName,
    customerDetails,
    callId
  );

  console.log("aiResponse", aiResponse);

  let shouldRedirectCall = false;
  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
    shouldRedirectCall = true;
  }

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

  const generatedSpeechFile = await convertTextToSpeech(
    cleanedAiResponse,
    voice
  );

  const textToSpeechFileURL = await uploadToS3(generatedSpeechFile, "123");

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

  return twiml.toString();
}

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

module.exports = {
  handleIncomingCall,
  handleSpeechInput,
  gatherSpeechInput,
  createVerification,
  checkVerification,
  getTwilioAccessToken,
  buyPhoneNumber,
  addVerifiedCallerId,
  createVerification,
  createVerifyService,
};
