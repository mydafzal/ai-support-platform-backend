const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");

const Assistant = require("../models/assistant.model");
const Business = require("../models/business.model");
const User = require("../models/user.model");

const { uploadToS3 } = require("../integrations/s3Storage");
const { convertTextToSpeech } = require("../integrations/textToSpeech");

const router = require("express").Router();

const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");

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

    let user = await User.findByPk(userId);

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

    business = business.toJSON();

    let promises = [
      convertTextToSpeech(greetingMessage, voiceId),
      convertTextToSpeech(farewellMessage, voiceId),
    ];

    const [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    promises = [
      uploadToS3(greetingMessageSpeech, user.id, "greetingMessage.mp3"),
      uploadToS3(farewellMessageSpeech, user.id, "farewellMessage.mp3"),
    ];
    const [greetingMessageUrl, farewellMessageUrl] = await Promise.all(
      promises
    );

    const assistant = await Assistant.create({
      userId: user.id,
      name: assistantName,
      voiceName,
      voiceId,
      greetingMessageUrl,
      farewellMessageUrl,
      knowledgeBaseName: uuidv4(),
    });

    res.status(201).json({ success: true, data: { business, assistant } });
  } catch (error) {
    console.error("Error adding business:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
