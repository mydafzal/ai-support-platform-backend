const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const {
  Assistant,
  Business,
  BusinessMembership,
  User,
  Invitation,
} = require("../../models");

const {
  convertTextToSpeech,
  cloneVoice,
} = require("../integrations/textToSpeech");

const fs = require("fs/promises");
const fsWithoutPromises = require("fs");

const { v4: uuidv4 } = require("uuid");

const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_BASE_URL,
  COMPANIES_FEATURE_ID,
  TEAM_MEMBERS_FEATURE_ID,
} = require("../utils/constants");
const SubscriptionService = require("./subscription.service");

async function addBusiness(data) {
  let {
    userId,
    businessName,
    assistantName,
    voiceName,
    voiceId,
    greetingMessage,
    farewellMessage,
    file,
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

  const hasReachedCompaniesLimit =
    await SubscriptionService.hasReachedFeatureLimit(
      COMPANIES_FEATURE_ID,
      userId
    );

  if (hasReachedCompaniesLimit) {
    throw {
      statuCode: 400,
      message: "Operation denied: Companies limit has been reached",
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

  await SubscriptionService.updateFeatureUsage(
    COMPANIES_FEATURE_ID,
    business.id,
    1
  );

  if (file) {
    voiceId = await cloneVoice(file.path, assistantName, userId);
    voiceName = assistantName;

    await fs.unlink(file.path);
  }

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
    file,
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

  const currentGreetingMessage = assistant.greetingMessage;
  const currentFarewellMessage = assistant.farewellMessage;
  voiceId = voiceId || assistant.voiceId;
  voiceName = voiceName || assistant.voiceName;

  if (file) {
    const adminUser = await BusinessMembership.findOne({
      where: {
        businessId,
        role: "Admin",
      },
      attributes: ["userId"],
      raw: true,
    });

    voiceId = await cloneVoice(file.path, voiceName, adminUser.userId);

    console.log("cloned voice id - ", voiceId);

    await fs.unlink(file.path);
  }

  if (
    greetingMessage ||
    (voiceId && voiceName) ||
    voiceId != assistant.voiceId
  ) {
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
  }

  if (
    farewellMessage ||
    (voiceId && voiceName) ||
    voiceId != assistant.voiceId
  ) {
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
  }

  assistantName = assistantName || assistant.name;
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

  return await getBusinessDetails({ businessId });
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

  const user = await User.findOne({
    where: {
      id: memberId,
    },
    attributes: ["email"],
    raw: true,
  });

  if (user) {
    await Invitation.destroy({
      where: {
        businessId,
        email: user.email,
      },
    });
  }

  await SubscriptionService.updateFeatureUsage(
    TEAM_MEMBERS_FEATURE_ID,
    businessId,
    -1
  );
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

async function deleteBusiness(data) {
  const { businessId } = data;

  const business = await Business.findOne({
    where: {
      id: businessId,
    },
    raw: true,
  });

  if (!business) {
    throw { statuCode: 404, message: "Business doesn't exist" };
  }

  await SubscriptionService.updateFeatureUsage(
    COMPANIES_FEATURE_ID,
    businessId,
    -1
  );

  await Business.destroy({
    where: {
      id: businessId,
    },
  });
}

const BusinessService = {
  addBusiness,
  updateBusiness,
  removeMember,
  getBusinessDetails,
  deleteBusiness,
};

module.exports = BusinessService;
