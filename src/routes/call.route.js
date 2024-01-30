const Router = require("express").Router;

const {
  getTwilioAccessToken,
  createVerification,
  checkVerification,
  // handleCallDisconnect,
  // disconnectRedirectedCall,
  handleIncomingCall,
  handleSpeechInput,
  gatherSpeechInput,
} = require("../controllers/call.controller");

const Business = require("../models/business.model");

const router = Router();

router.get("/access-token/:id?", (req, res) => {
  const result = getTwilioAccessToken(req.params.id);
  res.status(200).json(result);
});

router.post("/verification", async (req, res) => {
  const { phoneNumber, customerId } = req.body;

  let customer = await Business.findByPk(customerId);
  customer = customer.toJSON();

  const result = await createVerification(
    phoneNumber,
    customer.verifyServiceId
  );
  res.status(200).send(result);
});

router.post("/verification-check", async (req, res) => {
  const { code, phoneNumber } = req.body;

  const isVerified = await checkVerification(code, phoneNumber);
  res.status(200).send(isVerified);
});

router.post("/incoming-call", async (req, res) => {
  console.log("incoming call....");

  const result = await handleIncomingCall(req);

  res.type("application/xml");
  res.send(result);
});

router.post("/gather-speech", async (req, res) => {
  const result = await gatherSpeechInput();

  res.type("application/xml");
  res.send(result);
});

router.post("/speech-input", async (req, res) => {
  const result = await handleSpeechInput(req);

  res.type("application/xml");
  res.send(result);
});

router.post("/disconnect", (req, res) => {
  console.log("call-status - request.body.from", req.body.From);

  if (req.body.CallStatus === "completed") {
    handleCallDisconnect(req);
  }

  res.status(200).send();
});

router.post("/redirected-call-disconnect", (req, res) => {
  console.log("redirected call has been disconnected...");
  const result = disconnectRedirectedCall(req, res);

  res.type("application/xml");
  res.status(200).send(result);
});

module.exports = router;
