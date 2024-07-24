const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWIML_APP_SID;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;
const TWIML_VERIFY_SERVICE_ID = process.env.TWIML_VERIFY_SERVICE_ID;

const fs = require("fs");
const uuid = require("uuid");
const axios = require("axios");

const twilio = require("twilio");
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const { getContactByPhoneNumber } = require("../integrations/hubspotCRM");

const {
  generateCallAnsweringAgentResponse,
} = require("./callAnsweringAgent.controller");

const {
  deleteCallData,
  storeCallData,
  getCallData,
  updateCallConversation,
  redisClient,
} = require("../integrations/redis");
const { convertTextToSpeech } = require("../integrations/textToSpeech");
const {
  formatHubSpotContactDetails,
  formatTeamGroups,
} = require("../utils/formatters");

const {
  Business,
  Assistant,
  Integration,
  BusinessIntegration,
  IntegrationWarning,
  Call,
  User,
  TeamGroup,
} = require("../../models");

const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_EXTENSION,
  AUDIO_FILES_BASE_URL,
  CALL_RECORDINGS_BASE_PATH,
  HUBPOST_INTEGRATION_ID,
  CALL_MINUTES_FEATURE_ID,
  MEETING_FEATURE_ID,
} = require("../utils/constants");
const {
  generateFilename,
  getConnectedIntegrationsCount,
} = require("../utils/helpers");
const { sendEmail } = require("../integrations/nodemailer");
const { Op } = require("sequelize");
const SubscriptionService = require("../services/subscription.service");

async function handleIncomingCall(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const customerPhoneNumber = request.body.From;
  const businessPhoneNumber = request.body.To || "+14697074725";
  const callId = request.body.CallSid;

  console.log("request.body.To", request.body);

  let business = await Business.findOne({
    where: {
      twilioNumber: businessPhoneNumber,
    },
    include: [{ model: Assistant, as: "assistant" }],
  });

  business = business?.toJSON();

  if (!business) {
    twiml.say("Sorry, we can't handle your call.");
    return twiml.toString();
  }

  let hasReachedLimit = await SubscriptionService.hasReachedFeatureLimit(
    CALL_MINUTES_FEATURE_ID,
    business.id
  );

  if (hasReachedLimit) {
    twiml.say(
      "Sorry, we can't handle your call at the moment. please try again later."
    );
    return twiml.toString();
  }

  const { assistant } = business;

  await Call.create({
    id: callId,
    from: customerPhoneNumber,
    businessId: business.id,
  });

  let integration = await Integration.findOne({
    where: {
      id: HUBPOST_INTEGRATION_ID,
    },
    include: [
      {
        model: BusinessIntegration,
        as: "integration",
        where: {
          businessId: business.id,
        },
      },
    ],
  });

  integration = integration?.toJSON();

  let formattedCustomerDetails = "";
  let customerFullName = "";

  if (
    !integration ||
    !integration?.integration ||
    integration?.integration?.length <= 0
  ) {
    console.log(
      "HubSpot integration not available, couldn't retrieve customer's information."
    );

    await handleIntegrationWarning(
      callId,
      HUBPOST_INTEGRATION_ID,
      business.id,
      business.adminUserId
    );
  } else {
    integration = integration.integration[0];

    const contact = await getContactByPhoneNumber(
      integration.accessToken,
      integration.refreshToken,
      integration.expirationTime,
      customerPhoneNumber,
      business.id
    );

    if (contact) {
      formattedCustomerDetails = formatHubSpotContactDetails(contact);
      customerFullName = `${contact.properties.firstname} ${contact.properties.lastname}`;
    }
  }

  const count = await getConnectedIntegrationsCount(business.id);

  hasReachedLimit = await SubscriptionService.hasReachedFeatureLimit(
    MEETING_FEATURE_ID,
    business.id
  );

  // Businesses must connect both Google Calendar and Calendly integrations so that customers can schedule meetings on phone call.
  let canScheduleMeeting = count !== 3 || hasReachedLimit ? false : true;

  let teamGroups = await TeamGroup.findAll({
    where: {
      businessId: business.id,
    },
    attributes: ["name"],
  });

  teamGroups = teamGroups.map((member) => member.toJSON());
  teamGroups = formatTeamGroups(teamGroups);

  let callDetails = {
    businessId: business.id,
    businessName: business.name,
    businessPhoneNumber: business.twilioNumber,
    voiceId: assistant.voiceId,
    greetingMessageUrl: assistant.greetingMessageUrl,
    farewellMessageUrl: assistant.farewellMessageUrl,
    assistantName: assistant.name,
    collectionName: assistant.knowledgeBaseName,
    callId: callId,
    customerDetails: formattedCustomerDetails,
    customerName: customerFullName,
    customerPhoneNumber,
    shouldAddGreetingMessageToTranscription: false,
    shouldAddFarewellMessageToTranscription: false,
    canScheduleMeeting,
    teamGroups,
  };

  await storeCallData(callId, callDetails);

  twiml.play(callDetails.greetingMessageUrl);

  twiml.gather({
    speechTimeout: "auto",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/calls/speech-input`,
    actionOnEmptyResult: true,
  });

  startCallRecording(callId);
  return twiml.toString();
}

async function gatherSpeechInput() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.gather({
    // speechTimeout: "auto",
    speechTimeout: "15",
    speechModel: "experimental_conversations",
    input: "speech",
    action: `${BASE_URL}/calls/speech-input`,
    actionOnEmptyResult: true,
  });

  return twiml.toString();
}

async function handleSpeechInput(request) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const voiceInput = request.body.SpeechResult;
  console.log("caller voice input", voiceInput);

  const callId = request.body.CallSid;
  const callData = await getCallData(callId);

  let {
    farewellMessageUrl,
    businessId,
    businessName,
    customerName,
    customerPhoneNumber,
    assistantName,
    customerDetails,
    voiceId,
    collectionName,
    audioFileNames,
    businessPhoneNumber,
    shouldAddGreetingMessageToTranscription,
    teamGroups,
    canScheduleMeeting,
  } = callData;

  if (!shouldAddGreetingMessageToTranscription) {
    callData.shouldAddGreetingMessageToTranscription = true;
  }

  if (!voiceInput) {
    twiml.play(farewellMessageUrl);
    twiml.hangup();

    callData.shouldAddFarewellMessageToTranscription = true;
    await updateCallConversation(callId, callData);

    return twiml.toString();
  }

  const aiResponse = await generateCallAnsweringAgentResponse(
    voiceInput,
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
  );

  console.log("aiResponse", aiResponse);
  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

  let generatedSpeechFile = await convertTextToSpeech(
    cleanedAiResponse,
    voiceId
  );

  // Save the audio file locally
  generatedSpeechFile = Buffer.from(generatedSpeechFile);
  const fileName = generateFilename(AUDIO_FILES_EXTENSION);

  await fs.promises.writeFile(
    `${AUDIO_FILES_BASE_PATH}/${fileName}`,
    generatedSpeechFile
  );

  const textToSpeechFileURL = `${AUDIO_FILES_BASE_URL}/${fileName}`;

  const updatedCallData = await getCallData(callId);

  if (updatedCallData?.shouldRedirect) {
    console.log("Dialing the human agent's number...");
    console.log("groupToRedirect - ", groupToRedirect);

    let teamGroup;

    if (updatedCallData?.groupToRedirect?.length > 0) {
      teamGroup = await TeamGroup.findOne({
        where: {
          businessId,
          name: updatedCallData.groupToRedirect,
        },
      });
    }

    let whereCondition = { businessId, phone: { [Op.not]: null } };

    if (teamGroup) {
      teamGroup = teamGroup.toJSON();
      whereCondition.teamGroupId = teamGroup.id;
    }

    let teamMember = await User.findOne({
      where: whereCondition,
    });

    if (!teamMember || teamMember?.toJSON()?.phone?.length < 1) {
      twiml.say(
        "We couldn't connect your call to a human agent at the moment."
      );

      twiml.redirect(
        {
          method: "POST",
        },
        `${BASE_URL}/calls/gather-speech`
      );
    }

    //
    else {
      teamMember = teamMember.toJSON();

      await Call.update(
        {
          status: "Redirected",
          redirectedTo: teamMember.name,
        },
        {
          where: {
            id: callId,
          },
        }
      );

      twiml.play(textToSpeechFileURL);

      twiml
        .dial({
          callerId: businessPhoneNumber,
        })
        .number(
          {
            statusCallback: `${BASE_URL}/calls/disconnect`,
          },
          teamMember.phone
        );
    }
  }

  //
  else {
    twiml.play(textToSpeechFileURL);

    twiml.redirect(
      {
        method: "POST",
      },
      `${BASE_URL}/calls/gather-speech`
    );
  }

  if (!audioFileNames) callData.audioFileNames = [fileName];
  else callData.audioFileNames.push(fileName);

  await updateCallConversation(callId, callData);

  return twiml.toString();
}

async function createVerifyService(businessName) {
  try {
    const service = await client.verify.v2.services.create({
      friendlyName: businessName,
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

  const phoneNumberToPurchase = availableNumbers[0].phoneNumber;

  const purchasedNumber = await client.incomingPhoneNumbers.create({
    phoneNumber: phoneNumberToPurchase,
    friendlyName: "My Twilio Number",
  });

  console.log("purchasedNumber.phoneNumber", purchasedNumber.phoneNumber);

  const list = await client.incomingPhoneNumbers.list({
    phoneNumber: purchasedNumber.phoneNumber,
  });

  if (list.length > 0) {
    const sid = list[0].sid;

    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: `${process.env.BASE_URL}/calls/incoming-call`,
      statusCallback: `${process.env.BASE_URL}/calls/disconnect`,
    });
  }

  return purchasedNumber.phoneNumber;
  // return "+14697074725";
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
  try {
    const message = await client.messages.create({
      body,
      messagingServiceSid: MESSAGING_SERVICE_SID,
      to: phoneNumber,
    });

    console.log("message.sid=====", message.sid);
  } catch (error) {
    console.log("sendSMS error - ", error);
  }
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
      .services(TWIML_VERIFY_SERVICE_ID)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    if (verificationCheck.status === "approved") {
      isVerified = true;
    }

    return isVerified;
  } catch (error) {
    console.error("Error checking verification code:", error.message);
  }

  return isVerified;
}

async function handleCallDisconnect(request) {
  const callId = request.body.CallSid;
  console.log("call disconnected: ", request.body);

  await Call.update(
    {
      duration: request.body.CallDuration,
    },
    {
      where: {
        id: callId,
      },
    }
  );

  const callData = await getCallData(callId);

  if (callData?.audioFileNames) {
    // Delete all AI speeches that were generated during the call.
    const promises = callData?.audioFileNames?.map((fileName) =>
      fs.promises.unlink(`${AUDIO_FILES_BASE_PATH}/${fileName}`)
    );

    await Promise.all(promises);
  }

  let call = await Call.findByPk(callId, {
    attributes: ["businessId"],
    raw: true,
  });

  if (callData?.shouldAddGreetingMessageToTranscription) {
    const assistant = await Assistant.findOne({
      where: { businessId: call.businessId },
    });

    const greetingMessage = {
      type: "ai",
      content: assistant.toJSON().greetingMessage,
    };

    await redisClient.lPush(
      `transcription-${callId}`,
      JSON.stringify(greetingMessage)
    );

    if (callData.shouldAddFarewellMessageToTranscription) {
      const farewellMessage = {
        type: "ai",
        content: assistant.toJSON().farewellMessage,
      };

      await redisClient.rPush(
        `transcription-${callId}`,
        JSON.stringify(farewellMessage)
      );
    }
  }

  deleteCallData(callId);

  if (call) {
    const callDurationInSeconds = parseFloat(request.body.CallDuration);
    const callDurationInMinutes = parseFloat(
      (callDurationInSeconds / 60).toFixed(2)
    );

    await SubscriptionService.updateFeatureUsage(
      CALL_MINUTES_FEATURE_ID,
      call.businessId,
      callDurationInMinutes
    );
  }
}

async function startCallRecording(callId) {
  let tries = 0;

  try {
    const recording = await client.calls(callId).recordings.create({
      recordingStatusCallback: `${process.env.BASE_URL}/calls/recording`,
      trim: "trim-silence",
    });

    console.log("started call recording", recording.sid);
  } catch (error) {
    console.log("startCallRecording error - tries", tries);
    if (tries < 2) {
      startCallRecording(callId);
    }
  }
}

async function handleCompletedRecording(request) {
  const { CallSid, RecordingSid } = request.body;

  try {
    const response = await axios.default.get(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Recordings/${RecordingSid}.mp3`,
      {
        responseType: "arraybuffer",
        auth: {
          username: ACCOUNT_SID,
          password: AUTH_TOKEN,
        },
      }
    );

    await fs.promises.mkdir(`${CALL_RECORDINGS_BASE_PATH}`, {
      recursive: true,
    });

    await fs.promises.writeFile(
      `${CALL_RECORDINGS_BASE_PATH}/${CallSid}.mp3`,
      response.data
    );

    console.log("response - get recording mp3");

    const recordingUrl = `${BASE_URL}/data/call-recordings/${CallSid}.mp3`;

    await Call.update(
      {
        recordingUrl,
      },
      {
        where: {
          id: CallSid,
        },
      }
    );

    console.log("saved call recording");
  } catch (error) {
    console.log("Error downloading call recording from Twilio: ", error);
  }
}

async function handleIntegrationWarning(
  callId,
  integrationId,
  businessId,
  adminUserId
) {
  try {
    await Call.update(
      {
        warnings: [integrationId],
      },
      {
        where: {
          id: callId,
        },
      }
    );

    let integrationWarning = await IntegrationWarning.findOne({
      where: {
        businessId,
        integrationId: integrationId,
      },
    });

    integrationWarning = integrationWarning?.toJSON();

    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours cooldown period
    const currentTime = Date.now();

    if (
      !integrationWarning ||
      currentTime - new Date(integrationWarning.lastEmailSentAt) >=
        cooldownPeriod
    ) {
      let user = await User.findOne({
        where: {
          id: adminUserId,
        },
      });

      user = user.toJSON();

      // Trigger email to business to connect the CRM...
      const emailLink = `${process.env.CLIENT_BASE_URL}/integration?callId=${callId}`;

      const emailTemplate = `We couldn't retrieve details of your customer because you have not connected any CRM with Customer Bot. 
      </br>
      Click <a href="${emailLink}">here</a> to get redirected to the call during which this problem occured.`;

      await sendEmail(user.email, emailTemplate);

      if (integrationWarning) {
        await IntegrationWarning.update(
          {
            id: integrationWarning.id,
          },
          {
            lastEmailSentAt: new Date(),
          }
        );
      } else {
        await IntegrationWarning.create({
          businessId,
          integrationId,
          lastEmailSentAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.log("handleIntegrationWarning error - ", error);
  }
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
  handleCallDisconnect,
  handleCompletedRecording,
  sendSMS,
};
