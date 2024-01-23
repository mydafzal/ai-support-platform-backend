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
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const uuid = require("uuid");
const { getContactByPhoneNumber } = require("./hubspotCRM.controller");
const { generateCallAgentResponse } = require("./ai-response-generator");
const { deleteCallData, storeCallData, getCallData } = require("../redis");
const { uploadToS3 } = require("../s3-storage");
const { convertTextToSpeech } = require("../text-to-speech");

// Call comes in.
// Retreive customers phone number from the request.
// Retreive customers details from the crm.
// Initialize conversation with a system prompt that contains business and customer's details.
//

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const customerPhoneNumber = request.body.customerPhoneNumber;
  const businessPhoneNumber = request.body.To;

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
    ? formatCustomerDetails(contact)
    : "";

  //   const conversation = initializeConversation(formattedCustomerDetails);

  storeCallData(customerPhoneNumber, {
    ...businessDetails,
    customerDetails: formattedCustomerDetails,
    customerName: contact
      ? `${contact.properties.firstname} ${contact.properties.lastname}`
      : "",
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

function formatCustomerDetails(customer) {
  const properties = customer.properties;

  const formattedDetails = `
      - Name: ${properties.firstname} ${properties.lastname}
      - Email: ${properties.email}
      - Phone: ${properties.phone}
      - Customer ID: ${customer.id}
    `;

  return formattedDetails;
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
  } = callData;

  if (!voiceInput) {
    twiml.play(farewellMessageUrl);
    twiml.hangup();

    deleteCallData(customerPhoneNumber);

    return twiml.toString();
  }

  //   if (!conversation) {
  //     conversation = initializeConversation();

  //     callData.conversation = conversation;
  //     updateCallConversation(callerId, callData);
  //   }

  // conversation.push({ role: "user", content: `${voiceInput}` });

  let aiResponse = await generateCallAgentResponse(
    voiceInput,
    businessName,
    customerName,
    assistantName,
    customerDetails
  );

  //   while (aiResponse?.role === "tool") {
  //     conversation.push(aiResponse);
  //     aiResponse = await generateAIResponse(isPhoneCall, conversation, callData);
  //   }

  console.log("aiResponse", aiResponse);

  let shouldRedirectCall = false;
  if (aiResponse === "connect_to_human") {
    aiResponse = "You are now being connected to a human agent.";
    shouldRedirectCall = true;
  }

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();
  //   conversation.push({ role: "assistant", content: `${aiResponse}` });

  //   while (conversation.length > 20) {
  //     conversation.shift();
  //   }

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

module.exports = { handleIncomingCall, handleSpeechInput, gatherSpeechInput };
