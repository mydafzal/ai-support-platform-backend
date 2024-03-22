const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const Assistant = require("../models/assistant.model");
const Business = require("../models/business.model");
const User = require("../models/user.model");

const { convertTextToSpeech } = require("../integrations/textToSpeech");

const router = require("express").Router();
const fs = require("fs/promises");

const jwt = require("jsonwebtoken");

const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_BASE_URL,
} = require("../utils/constants");

const businessDetailsValidationSchema = z.object({
  userId: z.number(),
  businessName: z.string(),
  assistantName: z.string(),
  voiceId: z.string(),
  voiceName: z.string(),
  greetingMessage: z.string(),
  farewellMessage: z.string(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await businessDetailsValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const {
      userId,
      businessName,
      assistantName,
      voiceName,
      voiceId,
      greetingMessage,
      farewellMessage,
    } = req.body;

    let user = await User.findByPk(userId, {
      attributes: {
        exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
      },
    });

    if (!user?.toJSON()?.email) {
      return res.status(404).json({
        succcess: false,
        message: "User with the given id does not exist.",
      });
    }

    // const twilioNumber = await buyPhoneNumber();
    // const verifyServiceId = await createVerifyService(companyName);

    let business = await Business.create({
      businessName,
      twilioNumber: "+14697074725",
      verifyServiceId: "",
      userId: user.id,
    });

    business = await Business.findByPk(business.toJSON().id, {
      attributes: { exclude: ["userId"] },
    });

    business = business.toJSON();

    let promises = [
      convertTextToSpeech(greetingMessage, voiceId),
      convertTextToSpeech(farewellMessage, voiceId),
    ];

    let [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    greetingMessageSpeech = Buffer.from(greetingMessageSpeech);
    farewellMessageSpeech = Buffer.from(farewellMessageSpeech);

    const businessDataDirectoryPath = `${AUDIO_FILES_BASE_PATH}/business-${userId}`;
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

    const greetingMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${userId}/greetingMessage.mp3`;
    const farewellMessageUrl = `${AUDIO_FILES_BASE_URL}/business-${userId}/farewellMessage.mp3`;

    let assistant = await Assistant.create({
      userId: user.id,
      name: assistantName,
      voiceName,
      voiceId,
      greetingMessageUrl,
      farewellMessageUrl,
      greetingMessage,
      farewellMessage,
      knowledgeBaseName: uuidv4(),
    });

    assistant = await Assistant.findByPk(assistant.toJSON().id, {
      attributes: { exclude: ["userId"] },
    });

    assistant = assistant.toJSON();

    const token = jwt.sign(
      {
        ...user.toJSON(),
        assistant,
        business,
      },
      process.env.JWT_SECRET
    );

    res.status(201).json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error("Error adding business:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
