const Router = require("express").Router;
const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const Twilio = require("twilio");

const { nameGenerator } = require("./util");

// Personal twilio account
// const ACCOUNT_SID = "AC38de205937ab33d281c52f95f796107b";
// const API_KEY = "SK7eeb5340364290fd722197db55a79021";
// const API_SECRET = "dXVs0g5kF37d069sg5G5hjzUVI9CdiDf";
// const TWIML_APP_SID = "APb1223b5a22dfffdfd7298c1589266a5d";


// Cheetay Twilio account
const ACCOUNT_SID = "AC4aaae2efa313920547b86dff276458a3";
const API_KEY = "SKef8b2f0ea28e603f83b097fef0ffc219";
const API_SECRET = "bLQyI9w0bEWHenAUjlzUZ7NHV0ESt9Xi";
const TWIML_APP_SID = "APb30804e44d38228e19ab88b299c553b0";

const router = Router();

router.get("/token", (req, res) => {
  const identity = nameGenerator();

  console.log("identity: ", identity);

  // return;

  // const Access = Twilio.jwt.AccessToken;
  // new Access(ACCOUNT_SID, API_KEY, API_SECRET, );

  const accessToken = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
    identity,
  });

  // accessToken.identity = identity;

  const grant = new VoiceGrant({
    outgoingApplicationSid: TWIML_APP_SID,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);

  // Include identity and token in a JSON response
  // const response = {
  //   identity: identity,
  //   token: accessToken.toJwt(),
  // };

  // res.send(response);

  console.log("access token: ", accessToken);

  res.status(200).json({ token: accessToken.toJwt() });
});

module.exports = router;
