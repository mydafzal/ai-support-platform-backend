const router = require("express").Router();
const path = require("path");
const fs = require("fs/promises");

const {
  scrapeAndPersistData,
  readFileAndPersistData,
} = require("../controllers/dataLoader.controller");

const {
  deleteCollection,
  addTextToVectoreStore,
  deleteChunksByUrl,
  deleteChunksByDocument,
} = require("../integrations/chromaDB");

const { Assistant, Document, Business, Url } = require("../../models");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: "documents",
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const { z } = require("zod");
const {
  generateTrainingAgentResponse,
} = require("../controllers/trainingAgent.controller");
const { getBrowser } = require("../integrations/urlScreenshot");
const { DOCUMENTS_BASE_PATH } = require("../utils/constants");

const urlsValidationSchema = z.object({
  urls: z.array(z.string().url()),
  businessId: z.number(),
});

const teachChatValidationSchema = z.object({
  message: z.string(),
  businessId: z.number(),
});

router.post("/urls", async (req, res) => {
  try {
    const { urls, businessId } = req.body;

    const { success, error } = await urlsValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    if (!urls || urls?.length < 1) {
      return res.status(400).send("Provide one or more urls.");
    }

    let assistant = await Assistant.findOne({
      where: {
        businessId,
      },
    });

    if (!assistant) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    assistant = assistant.toJSON();

    let addUrlsResult = await Url.bulkCreate(
      urls.map((url) => ({
        link: url,
        businessId,
      }))
    );

    addUrlsResult = addUrlsResult.map((item) => item.toJSON());

    let promises = addUrlsResult.map((url) =>
      scrapeAndPersistData(url.link, assistant.knowledgeBaseName, url.id)
    );

    await Promise.all(promises);

    const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);

    await fs.mkdir(destinationPath, { recursive: true });

    const browser = getBrowser();

    await Promise.all(
      addUrlsResult.map(async (url) => {
        try {
          const page = await browser.newPage();

          await page.goto(url.link);

          await page.screenshot({
            path: `${destinationPath}/url-${url.id}-preview.png`,
          });

          console.log("took screenshot");
        } catch (error) {
          console.log("error taking screenshot.", error);
        }
      })
    );

    res
      .status(201)
      .json({ success: true, message: "Data loaded from provided urls." });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res
      .status(500)
      .json({ success: false, falsemessage: "Internal Server Error" });
  }
});

router.delete("/urls/:id", async (req, res) => {
  const urlId = req.params.id;

  try {
    let url = await Url.findByPk(urlId, {
      include: [
        {
          model: Business,
          as: "business",
          include: [{ model: Assistant, as: "assistant" }],
        },
      ],
    });

    if (!url) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid url id." });
    }

    url = url?.toJSON();

    await Url.destroy({
      where: {
        id: urlId,
      },
    });

    console.log("url ", url);

    const {
      id: businessId,
      assistant: { knowledgeBaseName },
    } = url.business;

    await deleteChunksByUrl(knowledgeBaseName, urlId);

    const filePath = path.join(
      DOCUMENTS_BASE_PATH,
      `${businessId}`,
      `url-${urlId}-preview.png`
    );

    fs.unlink(filePath)
      .then(() => {
        console.log("Url preview image deleted");
      })
      .catch(() => {
        console.log("Error deleting url preview image.");
      });

    res
      .status(200)
      .json({ success: true, message: "Url deleted successfully." });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/documents", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files?.length < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Provide one or more files." });
    } else if (!req.body.businessId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    let assistant = await Assistant.findOne({
      where: {
        businessId: req.body.businessId,
      },
    });

    if (!assistant) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    assistant = assistant.toJSON();

    let documents = await Document.bulkCreate(
      req.files.map((file) => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        businessId: req.body.businessId,
      }))
    );

    documents = documents.map((doc) => doc.toJSON());

    let promises = documents.map((document) => {
      const filePath = path.join(
        __dirname,
        "..",
        "..",
        "documents",
        document.name
      );

      return readFileAndPersistData(
        filePath,
        assistant.knowledgeBaseName,
        document.id
      );
    });

    await Promise.all(promises);

    console.log("files", req.files);

    const destinationPath = path.join(
      DOCUMENTS_BASE_PATH,
      `${req.body.businessId}`
    );

    await fs.mkdir(destinationPath, { recursive: true });

    promises = documents.map((file) => {
      const sourcePath = path.join(
        __dirname,
        "..",
        "..",
        "documents",
        file.name
      );
      return fs.rename(sourcePath, `${destinationPath}/${file.name}`);
    });

    await Promise.all(promises);

    res
      .status(201)
      .json({ success: true, message: "Data loaded from provided files." });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  const documentId = req.params.id;

  try {
    let document = await Document.findByPk(documentId);

    if (!document) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid document id." });
    }

    document = document.toJSON();

    await Document.destroy({
      where: {
        id: documentId,
      },
    });

    const filePath = path.join(
      DOCUMENTS_BASE_PATH,
      `${document.businessId}`,
      document.name
    );

    await fs.unlink(filePath);

    let assistant = await Assistant.findOne({
      where: {
        businessId: document.businessId,
      },
    });

    assistant = assistant.toJSON();
    await deleteChunksByDocument(assistant.knowledgeBaseName, documentId);

    res
      .status(200)
      .json({ success: true, message: "Document deleted successfully." });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/chat", async (req, res) => {
  const { message, businessId } = req.body;

  try {
    const { success, error } = await teachChatValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let business = await Business.findOne({
      where: {
        id: businessId,
      },
      include: [{ model: Assistant, as: "assistant" }],
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id." });
    }

    business = business.toJSON();

    const aiResponse = await generateTrainingAgentResponse(
      message,
      business.assistant.knowledgeBaseName,
      business.assistant.name,
      businessId
    );

    const data = {
      type: "ai",
      timestamp: new Date().getTime(),
      content: aiResponse,
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error getting training agent's response: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
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

router.delete("/:name", async (req, res) => {
  await deleteCollection(req.params.name);
  res.send("deleted.");
});

module.exports = router;
