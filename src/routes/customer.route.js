const {
  buyPhoneNumber,
  createVerifyService,
} = require("../controllers/call.controller");
const Assistant = require("../models/assistant.model");
const CompanyHistory = require("../models/companyHistory.model");
const Integration = require("../models/integration.model");
const Business = require("../models/business.model");
const { uploadToS3 } = require("../integrations/s3Storage");
const { convertTextToSpeech } = require("../integrations/textToSpeech");

const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    const {
      customerName,
      email,
      companyName,
      companyHistory,
      phoneNumbers,
      assistantName,
      voice,
      greetingMessage,
      farewellMessage,
    } = req.body;

    let customer = await Business.findOne({
      where: {
        email,
      },
    });

    if (customer?.toJSON()?.email) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const twilioNumber = await buyPhoneNumber();
    const verifyServiceId = await createVerifyService(companyName);

    customer = await Business.create({
      name: customerName,
      email,
      companyName,
      twilioNumber,
      phoneNumbers,
      verifyServiceId,
    });

    const companyHistoryObjects = companyHistory?.map((item) => ({
      ...item,
      customerId: customer.id,
    }));

    const history = await CompanyHistory.bulkCreate(companyHistoryObjects);

    let promises = [
      convertTextToSpeech(greetingMessage, voice),
      convertTextToSpeech(farewellMessage, voice),
    ];
    const [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    promises = [
      uploadToS3(greetingMessageSpeech, customer.id, "greetingMessage.mp3"),
      uploadToS3(farewellMessageSpeech, customer.id, "farewellMessage.mp3"),
    ];
    const [greetingMessageUrl, farewellMessageUrl] = await Promise.all(
      promises
    );

    const assistant = await Assistant.create({
      customerId: customer.id,
      name: assistantName,
      voice,
      greetingMessageUrl,
      farewellMessageUrl,
    });

    res.status(201).json({ customer, assistant, history });
  } catch (error) {
    console.error("Error adding customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    let customer = await Business.findOne({
      where: {
        email,
      },
    });

    const assistant = await Assistant.findOne({
      where: {
        customerId: customer.id,
      },
    });

    const history = await CompanyHistory.findAll({
      where: {
        customerId: customer.id,
      },
    });

    const credentials = await Integration.findOne({
      where: {
        customerId: customer.id,
      },
    });

    customer = customer.toJSON();
    customer.history = history.map((item) => item.toJSON());
    customer.assistant = assistant.toJSON();
    customer.credentials = credentials.toJSON();

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const formattedHistory = customer.history
      .map((entry) => `${entry.section}:\n${entry.content}`)
      .join("\n\n");

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
