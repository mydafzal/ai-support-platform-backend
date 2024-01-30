const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");
const Assistant = require("../models/assistant.model");
const Integration = require("../models/integration.model");
const Business = require("../models/business.model");
const { uploadToS3 } = require("../integrations/s3Storage");
const { convertTextToSpeech } = require("../integrations/textToSpeech");
const User = require("../models/user.model");

const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      businessName,
      assistantName,
      voiceName,
      voiceId,
      greetingMessage,
      farewellMessage,
      externalId,
      externalType,
    } = req.body;

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (user?.toJSON()?.email) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // const twilioNumber = await buyPhoneNumber();
    // const verifyServiceId = await createVerifyService(companyName);

    const business = await Business.create({
      businessName,
      twilioNumber: "",
      verifyServiceId: "",
    });

    user = await User.create({
      name,
      email,
      externalId,
      externalType,
    });

    let promises = [
      convertTextToSpeech(greetingMessage, voiceId),
      convertTextToSpeech(farewellMessage, voiceId),
    ];

    const [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    promises = [
      uploadToS3(greetingMessageSpeech, business.id, "greetingMessage.mp3"),
      uploadToS3(farewellMessageSpeech, business.id, "farewellMessage.mp3"),
    ];
    const [greetingMessageUrl, farewellMessageUrl] = await Promise.all(
      promises
    );

    const assistant = await Assistant.create({
      businessId: business.id,
      name: assistantName,
      voiceName,
      greetingMessageUrl,
      farewellMessageUrl,
    });

    res.status(201).json({ business, assistant, history });
  } catch (error) {
    console.error("Error adding business:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    let business = await Business.findOne({
      where: {
        email,
      },
    });

    const assistant = await Assistant.findOne({
      where: {
        customerId: business.id,
      },
    });

    const credentials = await Integration.findOne({
      where: {
        customerId: business.id,
      },
    });

    business = business.toJSON();
    business.assistant = assistant.toJSON();
    business.credentials = credentials.toJSON();

    if (!business) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json({ response: "" });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
