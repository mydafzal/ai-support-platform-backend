const router = require("express").Router();
const path = require("path");

const multer = require("multer");
const {
  scrapeAndPersistData,
  readFileAndPersistData,
  generateAgentResponse,
} = require("../experimentation/langchain");
const upload = multer({ dest: "documents/" });

const { deleteCollection } = require("../experimentation/chroma-db");

router.post("/web", async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || urls?.length < 1) {
      return res.status(400).send("Provide one or more urls.");
    }

    const promises = urls.map((url) => scrapeAndPersistData(url));

    await Promise.all(promises);

    res.status(200).send("Data loaded from provided urls.");
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/documents", upload.array("files"), async (req, res) => {
  try {
    console.log("files", req.files);

    if (!req.files || req.files?.length < 1) {
      return res.status(400).send("Provide one or more files.");
    }

    const promises = req.files.map((file) => {
      const filePath = path.join(__dirname, "documents", file.filename);

      return readFileAndPersistData(filePath);
    });

    await Promise.all(promises);

    res.status(200).send("Data loaded from provided files.");
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/", async (req, res) => {
  try {
    await deleteCollection("");

    res.status(200).json({ response: "" });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/ask", async (req, res) => {
  const { question } = req.body;
  try {
    console.log("files", req.files);

    const response = await generateAgentResponse(question);
    res.status(200).send(response);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
