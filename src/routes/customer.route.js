const Assistant = require("../models/assistant.model");
const Customer = require("../models/customer.model");
const { uploadToS3 } = require("../s3-storage");
const { convertTextToSpeech } = require("../text-to-speech");

const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    const {
      customerName,
      email,
      companyName,
      companyHistory,
      twilioNumber,
      phoneNumbers,
      assistantName,
      voice,
      greetingMessage,
      farewellMessage,
    } = req.body;

    const customer = await Customer.create({
      name: customerName,
      email,
      companyName,
      companyHistory,
      twilioNumber,
      phoneNumbers,
    });

    let promises = [
      convertTextToSpeech(greetingMessage),
      convertTextToSpeech(farewellMessage),
    ];

    const [greetingMessageSpeech, farewellMessageSpeech] = await Promise.all(
      promises
    );

    promises = [
      uploadToS3(greetingMessageSpeech),
      uploadToS3(farewellMessageSpeech),
    ];

    const [greetingMessageUrl, farewellMessageUrl] = await Promise.all(
      promises
    );

    const assistant = await Assistant.create({
    //   customerId: customer.id,
      name: assistantName,
      voice,
      greetingMessageUrl,
      farewellMessageUrl,
    });

    res.status(201).json({ customer, assistant });
  } catch (error) {
    console.error("Error adding customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get a specific customer by ID
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const customer = await Customer.findOne({
      where: {
        email,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
