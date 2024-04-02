const router = require("express").Router();
const {
  generateTrainingAgentResponse,
} = require("../controllers/trainingAgent.controller");
const {
  generateCallAnsweringAgentResponse,
} = require("../controllers/callAnsweringAgent.controller");
const Assistant = require("../../models");

router.post("/teach", async (req, res) => {
  const { question, businessId } = req.body;

  let assistant = await Assistant.findOne({
    where: {
      businessId,
    },
  });
  assistant = assistant.toJSON();

  const { knowledgeBaseName } = assistant;
  const threadId = assistant.businessId; // Either teach thread's id or business's id if only single teach thread.

  try {
    const response = await generateTrainingAgentResponse(
      question,
      knowledgeBaseName,
      threadId
    );

    res.status(200).json({ answer: response });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/ask-agent/business", async (req, res) => {
  const { question } = req.body;

  try {
    const response = await generateAgentResponse(question);
    res.status(200).send(response);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/ask-agent/customer", async (req, res) => {
  const { question } = req.body;

  try {
    const response = await generateCallAnsweringAgentResponse(question);
    res.status(200).send(response);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
