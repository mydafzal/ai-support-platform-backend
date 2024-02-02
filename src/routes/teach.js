const router = require("express").Router();
const path = require("path");

const {
  scrapeAndPersistData,
  readFileAndPersistData,
} = require("../controllers/dataLoader.controller");

const {
  deleteCollection,
  addTextToVectoreStore,
} = require("../integrations/chromaDB");
const Assistant = require("../models/assistant.model");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: "documents",
  filename: (req, file, cb) => {
    // let fileExtension = path.extname(file.originalname);

    // let extArray = file.mimetype.split("/");
    // fileExtension = extArray[extArray.length - 1];

    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/scrape", async (req, res) => {
  try {
    const { urls, businessId } = req.body;

    if (!urls || urls?.length < 1) {
      return res.status(400).send("Provide one or more urls.");
    }

    let assistant = await Assistant.findOne({
      where: {
        businessId,
      },
    });
    assistant = assistant.toJSON();

    const promises = urls.map((url) =>
      scrapeAndPersistData(url, assistant.knowledgeBaseName)
    );

    await Promise.all(promises);

    res.status(200).json({ message: "Data loaded from provided urls." });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/upload", upload.array("files"), async (req, res) => {
  try {
    console.log("files", req.files);

    if (!req.files || req.files?.length < 1) {
      return res.status(400).send("Provide one or more files.");
    }

    let assistant = await Assistant.findOne({
      where: {
        businessId: req.body.businessId,
      },
    });
    assistant = assistant.toJSON();

    const promises = req.files.map((file) => {
      const filePath = path.join(
        __dirname,
        "..",
        "..",
        "documents",
        file.filename
      );
      return readFileAndPersistData(filePath, assistant.knowledgeBaseName);
    });

    await Promise.all(promises);

    res.status(200).json({ message: "Data loaded from provided files." });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:businessId", async (req, res) => {
  try {
    let assistant = await Assistant.findOne({
      where: {
        businessId: req.params.businessId,
      },
    });
    assistant = assistant.toJSON();

    await deleteCollection(assistant.knowledgeBaseName);

    res.status(200).json({ response: "" });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/create-flow", async (req, res) => {
  try {
    await addTextToVectoreStore(`
    User: Can you help me find a laptop?
    AI: Hello! I'd be happy to help you find the perfect laptop. To get started, could you please tell me a bit more about your preferences?
    
    User: I need a laptop for gaming.
    AI: Great choice! Gaming laptops have unique features. What's your preferred budget range, and are there any specific brands you're interested in?

    User: "Customer specifies a budget and mentions a preferred brand."
    AI: Awesome! Given your budget and preference for [Brand], I recommend considering the [Model A] or [Model B]. These both offer excellent performance for gaming.

    User: "Customer asks for more information about [Model A]."
    AI: Certainly! [Model A] features [specifications], and customers have praised its performance for gaming. Additionally, we currently have a promotion that includes [details].
    
    User: "Customer expresses interest in purchasing [Model A]."
    AI: Fantastic choice! I can help you with the order. Would you like to proceed with the purchase, or do you have any other questions?`);
    res.status(200).send("added.");
  } catch (error) {
    console.error("Error adding text to vector store.", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
