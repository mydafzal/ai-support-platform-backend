const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const sequelize = require("sequelize");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const {
  Assistant,
  Business,
  User,
  Invitation,
  Url,
  Document,
  TeamGroup,
  Call,
  CallTag,
  Integration,
  BusinessIntegration,
  Chat,
  ChatWidget,
  PricingPlan,
  Feature,
  Subscription,
  SubscriptionFeature,
} = require("../../models");

const { convertTextToSpeech } = require("../integrations/textToSpeech");

const router = require("express").Router();
const fs = require("fs/promises");
const fsWithoutPromises = require("fs");

const jwt = require("jsonwebtoken");

const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_BASE_URL,
  CARD_BRAND_LOGOS,
  FREE_PLAN_ID,
} = require("../utils/constants");
const { Sequelize } = require("sequelize");

const { redisClient } = require("../integrations/redis");
const {
  capitalizeFirstLetterOfEachWord,
  getNextMonthlyResetDate,
} = require("../utils/helpers");
const StripeService = require("../services/stripe.service");

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
    adminUserId: userId,
  });

  business = business.toJSON();

  await User.update(
    {
      businessId: business.id,
      role: "Admin",
    },
    {
      where: { id: userId },
    }
  );

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

  await Assistant.create({
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

  user = await User.findOne({
    where: {
      id: userId,
    },
    include: [
      {
        model: Business,
        as: "business",
        include: [
          {
            model: Assistant,
            as: "assistant",
          },
        ],
      },
    ],
    raw: true,
    nest: true,
  });

  return jwt.sign(
    {
      ...user,
    },
    process.env.JWT_SECRET
  );
}

async function updateBusiness(data) {
  const {
    businessId,
    businessName,
    assistantName,
    voiceName,
    voiceId,
    greetingMessage,
    farewellMessage,
  } = data;

  let count = await Business.count({
    where: {
      id: businessId,
    },
  });

  if (count <= 0) {
    throw { statusCode: 400, message: "Invalid business id." };
  }

  if (businessName) {
    await Business.update(
      {
        name: businessName,
      },
      {
        where: {
          id: businessId,
        },
      }
    );
  }

  let assistant = await Assistant.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  let greetingMessageUrl = assistant.greetingMessageUrl;
  let farewellMessageUrl = assistant.farewellMessageUrl;
  voiceId = voiceId || assistant.voiceId;

  if (greetingMessage) {
    let greetingMessageSpeech = await convertTextToSpeech(
      greetingMessage,
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

  if (farewellMessage) {
    let farewellMessageSpeech = await convertTextToSpeech(
      farewellMessage,
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

const BusinessService = {
  addBusiness,
  updateBusiness,
};

module.exports = BusinessService;
