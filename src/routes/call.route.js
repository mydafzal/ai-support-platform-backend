const Router = require("express").Router;

const {
  getTwilioAccessToken,
  createVerification,
  checkVerification,
  handleIncomingCall,
  handleSpeechInput,
  gatherSpeechInput,
  handleCallDisconnect,
  handleCompletedRecording,
} = require("../controllers/call.controller");

const { Business, User } = require("../../models");

const router = Router();

const { z } = require("zod");

const verficationCheckValidationSchema = z.object({
  code: z.string().length(4),
  phone: z.string(),
  userId: z.number(),
});

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
  const { code, phone, userId } = req.body;

  try {
    const { success, error } =
      await verficationCheckValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const isVerified = await checkVerification(code, phone);

    await User.update(
      {
        phoneVerified: isVerified,
      },
      {
        where: {
          userId,
        },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        isVerified,
      },
    });
  } catch (error) {
    console.log("Error verifying phone number: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
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

router.post("/recording", async (req, res) => {
  await handleCompletedRecording(req);
  res.status(200).send();
});

router.post("/disconnect", async (req, res) => {
  console.log("call-status - request.body.from", req.body.From);

  if (req.body.CallStatus === "completed") {
    handleCallDisconnect(req);
  }

  res.status(200).send();
});

router.post("/redirected-call-disconnect", async (req, res) => {
  console.log("redirected call has been disconnected...");
  const result = disconnectRedirectedCall(req, res);

  res.type("application/xml");
  res.status(200).send(result);
});

module.exports = router;
