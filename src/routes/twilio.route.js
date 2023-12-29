const Router = require("express").Router;

const {
  getTwilioAccessToken,
  createVerification,
  checkVerification,
  handleIncomingCall,
  gatherSpeechInput,
  handleSpeechInput,
} = require("../controllers/twilio.controller");

const router = Router();

router.get("/access-token/:id?", (req, res) => {
  const result = getTwilioAccessToken(req.params.id);
  res.status(200).json(result);
});

router.post("/verification/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.body;

  const result = await createVerification(phoneNumber);
  res.status(200).send(result);
});

router.post("/verification-check", async (req, res) => {
  const { code, phoneNumber } = req.body;

  const isVerified = await checkVerification(code, phoneNumber);
  res.status(200).send(isVerified);
});

router.post("/verification-check", async (req, res) => {
  const { code, phoneNumber } = req.body;

  const isVerified = await checkVerification(code, phoneNumber);
  res.status(200).send(isVerified);
});

router.post("/incoming-call", async (req, res) => {
  const result = await handleIncomingCall(req);

  res.type("application/xml");
  res.send(result);
});

router.post("/gather-speech", async (req, res) => {
  const result = await gatherSpeechInput(req);

  res.type("application/xml");
  res.send(result);
});

router.post("/speech-input", async (req, res) => {
  const result = await handleSpeechInput(req);

  res.type("application/xml");
  res.send(result);
});

router.post("/empty-recording", async (req, res) => {
  return await handleEmptyRecording(req, res);
});

router.post("/disconnect", async (req, res) => {
  console.log("call-status - request.body.from", req.body.From);

  if (req.body.CallStatus === "completed") {
    handleCallDisconnect(req);
  }

  res.status(200).send();
});

router.post("/call-end", async (req, res) => {
  console.log("call ended...");
  return await handleDial(req, res);
});

module.exports = router;
