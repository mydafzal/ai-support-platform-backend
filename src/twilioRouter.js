const Router = require("express").Router;
const { OpenAI } = require("openai");
const {
  handleTranscription,
  handleReponse,
  handleEmptyRecording,
  handleDial,
  handleCallDisconnect,
} = require("./controller");

const OPENAI_API_KEY = "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";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const router = Router();

router.post("/incoming-call", async (req, res) => {
  console.log("incoming...........");
  return await handleTranscription(req, res);
});

router.post("/transcribe", async (req, res) => {
  return await handleTranscription(req, res);
});

router.post("/respond", async (req, res) => {
  return await handleReponse(req, res);
});

module.exports = router;
