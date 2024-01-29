const router = require("express").Router();
const {
  generateTrainingAgentResponse,
} = require("../controllers/trainingAgent.controller");

router.post("/teach", async (req, res) => {
  const { question } = req.body;

  try {
    console.log("files", req.files);

    const response = await generateTrainingAgentResponse(question);
    res.status(200).send(response);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/ask-agent", async (req, res) => {
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
