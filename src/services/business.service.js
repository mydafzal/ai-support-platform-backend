const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const {
  Assistant,
  Business,
  BusinessMembership,
  User,
} = require("../../models");

const { convertTextToSpeech } = require("../integrations/textToSpeech");

const fs = require("fs/promises");
const fsWithoutPromises = require("fs");

const { v4: uuidv4 } = require("uuid");

const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_BASE_URL,
} = require("../utils/constants");
const {
  initalizeSubscriptionFeaturesofBusiness,
} = require("./business-feature.service");

async function addBusiness(data) {
  const {
    userId,
    businessName,
    assistantName,
    voiceName,
    voiceId,
    greetingMessage,
    farewellMessage,
  } = data;

  let user = await User.findByPk(userId, {
    attributes: {
      exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
    },
    raw: true,
  });

  if (!user) {
    throw {
      statusCode: 404,
      message: "User with the given id does not exist.",
    };
  }

  // const twilioNumber = await buyPhoneNumber();
  // const verifyServiceId = await createVerifyService(businessName);

  let business = await Business.create({
    name: businessName,
    twilioNumber: "+14697074725",
    // twilioNumber: twilioNumber || "+14697074725",
    verifyServiceId: "",
  });

  business = business.toJSON();

  await BusinessMembership.create({
    businessId: business.id,
    userId: user.id,
    role: "Admin",
  });

  let promises = [
    convertTextToSpeech(greetingMessage, voiceId),
    convertTextToSpeech(farewellMessage, voiceId),
  ];

  let [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
    promises
  );

  greetingMessageSpeech = Buffer.from(greetingMessageSpeech);
  farewellMessageSpeech = Buffer.from(farewellMessageSpeech);

  const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${business.id}`;
  await fs.mkdir(businessDataDirectoryPath, {
    recursive: true,
  });

  promises = [
    fs.writeFile(
      `${businessDataDirectoryPath}/greetingMessage.mp3`,
      greetingMessageSpeech
    ),
    fs.writeFile(
      `${businessDataDirectoryPath}/farewellMessage.mp3`,
      farewellMessageSpeech
    ),
  ];

  await Promise.all(promises);

  const greetingMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${business.id}/greetingMessage.mp3`;
  const farewellMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${business.id}/farewellMessage.mp3`;

  let assistant = await Assistant.create({
    businessId: business.id,
    name: assistantName,
    voiceName,
    voiceId,
    greetingMessageUrl,
    farewellMessageUrl,
    greetingMessage,
    farewellMessage,
    knowledgeBaseName: uuidv4(),
  });

  business.assistant = assistant.toJSON();

  await initalizeSubscriptionFeaturesofBusiness(userId, business.id);
  return business;
}

async function updateBusiness(data) {
  let {
    businessId,
    businessName,
    assistantName,
    voiceName,
    voiceId,
    greetingMessage,
    farewellMessage,
    leadMode,
  } = data;

  let count = await Business.count({
    where: {
      id: businessId,
    },
  });

  if (count <= 0) {
    throw { statusCode: 400, message: "Invalid business id." };
  }

  const updatedBusinessDetails = {};

  if (businessName) {
    updatedBusinessDetails.name = businessName;
  }
  if (typeof leadMode === "boolean") {
    updatedBusinessDetails.leadMode = leadMode;
  }

  await Business.update(
    { ...updatedBusinessDetails },
    {
      where: {
        id: businessId,
      },
    }
  );

  let assistant = await Assistant.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  let greetingMessageUrl = assistant.greetingMessageUrl;
  let farewellMessageUrl = assistant.farewellMessageUrl;

  const currentGreetingMessage = assistant.greetingMessage;
  const currentFarewellMessage = assistant.farewellMessage;
  voiceId = voiceId || assistant.voiceId;

  if (greetingMessage || (voiceId && voiceName)) {
    let greetingMessageSpeech = await convertTextToSpeech(
      greetingMessage || currentGreetingMessage,
      voiceId
    );
    greetingMessageSpeech = Buffer.from(greetingMessageSpeech);

    const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${businessId}`;

    const exists = fsWithoutPromises.existsSync(
      `${businessDataDirectoryPath}/greetingMessage.mp3`
    );

    if (exists) {
      await fs.unlink(`${businessDataDirectoryPath}/greetingMessage.mp3`);
    }

    await fs.writeFile(
      `${businessDataDirectoryPath}/greetingMessage.mp3`,
      greetingMessageSpeech
    );

    greetingMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${businessId}/greetingMessage.mp3`;
  }

  if (farewellMessage || (voiceId && voiceName)) {
    let farewellMessageSpeech = await convertTextToSpeech(
      farewellMessage || currentFarewellMessage,
      voiceId
    );
    farewellMessageSpeech = Buffer.from(farewellMessageSpeech);

    const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${businessId}`;

    const exists = fsWithoutPromises.existsSync(
      `${businessDataDirectoryPath}/farewellMessage.mp3`
    );

    if (exists) {
      await fs.unlink(`${businessDataDirectoryPath}/farewellMessage.mp3`);
    }

    await fs.writeFile(
      `${businessDataDirectoryPath}/farewellMessage.mp3`,
      farewellMessageSpeech
    );

    farewellMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${businessId}/farewellMessage.mp3`;
  }

  assistantName = assistantName || assistant.name;
  voiceName = voiceName || assistant.voiceName;
  greetingMessage = greetingMessage || assistant.greetingMessage;
  farewellMessage = farewellMessage || assistant.farewellMessage;

  await Assistant.update(
    {
      name: assistantName,
      voiceId,
      voiceName,
      greetingMessage,
      farewellMessage,
    },
    {
      where: { businessId },
    }
  );

  return {
    businessId,
    businessName,
    assistantName,
    voiceName,
    voiceId,
    greetingMessage,
    farewellMessage,
    greetingMessageUrl,
    farewellMessageUrl,
  };
}

async function removeMember(data) {
  let { businessId, memberId } = data;

  const membership = await BusinessMembership.findOne({
    where: {
      businessId,
      userId: memberId,
    },
    attributes: ["role"],
    raw: true,
  });

  if (membership?.role === "Admin") {
    throw {
      statusCode: 400,
      message: "Admin user cannot be removed from an organization",
    };
  }

  await BusinessMembership.destroy({
    where: {
      businessId,
      userId: memberId,
    },
  });
}

async function getBusinessDetails(data) {
  let { businessId } = data;

  const business = await Business.findOne({
    where: {
      id: businessId,
    },
    include: [
      {
        model: Assistant,
        as: "assistant",
      },
    ],
    raw: true,
    nest: true,
  });

  if (!business) {
    throw {
      statusCode: 404,
      message: "Invalid business id",
    };
  }

  return business;
}

const BusinessService = {
  addBusiness,
  updateBusiness,
  removeMember,
  getBusinessDetails,
};

module.exports = BusinessService;
