const Router = require("express").Router;
const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const { nameGenerator } = require("./util");

const uuid = require("uuid");

// Personal twilio account
// const ACCOUNT_SID = "ACe30c507dd2c1cb83c470ee8a8215621a";
// const API_KEY = "SKe4ed26b50fa41c3df0e928b2fc327ec6";
// const API_SECRET = "SaXwUlXx520AgzCYpFFlTgZ1dSUGv4oZ";
// const TWIML_APP_SID = "APd0e63c3591f1a96d4e65b42b50b5f4db";

// Cheetah Twilio account
const ACCOUNT_SID = "AC0ea48061c1c3c4fc80453e587912191f";
const API_KEY = "SK02d47ccec723de76f2cc160b515700b4";
const API_SECRET = "Njxq4cMzLqTNwNwXlUmP1QVuMyutnK20";
const TWIML_APP_SID = "AP6b57abe5bf5d09a9a42e30eda83a3556";
const AUTH_TOKEN = "11cc0d1ee279310ad0c7af5131efd7dc";
const VERIFY_SERVICE_SID = "VA6ce2779b9da4820716711c2b300d4dab";

const client = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);

const router = Router();

router.get("/token/:id?", (req, res) => {
  // const identity = nameGenerator();

  let userId = req.params.id;
  if (!userId) {
    userId = uuid.v4();
  }

  // console.log("identity: ", identity);
  console.log("userId: ", userId);

  const accessToken = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
    identity: userId,
  });

  const grant = new VoiceGrant({
    outgoingApplicationSid: TWIML_APP_SID,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);

  console.log("access token: ", accessToken);

  res.status(200).json({ token: accessToken.toJwt(), userId });
});

router.get("/verification/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const verification = await client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
      });

    console.log("Verification code sent:", verification.sid);
  } catch (error) {
    console.error("Error sending verification code:", error.message);
  }

  res.status(200).send("Verification code sent");
});

router.post("/verification-check", async (req, res) => {
  const { code, phoneNumber } = req.body;

  console.log("req.body", req.body);

  let isVerified = false;

  try {
    const verificationCheck = await client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    if (verificationCheck.status === "approved") {
      isVerified = true;
    }
  } catch (error) {
    console.error("Error checking verification code:", error.message);
  }
  res.status(200).send(isVerified);
});

module.exports = router;
