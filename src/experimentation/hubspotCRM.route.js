const Router = require("express").Router;
const router = Router();

const moment = require("moment");
const fs = require("fs");
const path = require("path");

const {
  getHubSpotAccessToken,
  getContactByPhoneNumber,
} = require("./hubspotCRM.controller");

router.get("/auth-url", (req, res) => {
  console.log("process.env.HUBSPOT_AUTH_URL", process.env.HUBSPOT_AUTH_URL);
  return res.status(200).send(process.env.HUBSPOT_AUTH_URL);
});

router.post("/auth-callback", async (req, res) => {
  const { code, redirecUri, customerId } = req.body;

  const response = await getHubSpotAccessToken(code, redirecUri);

  const filePath = path.join(__dirname, "token.json");

  fs.writeFile(
    filePath,
    JSON.stringify({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expirationTime: moment(new Date())
        .add(response.expiresIn, "seconds")
        .toDate(),
    }),
    (result) => {
      console.log("tokens saved.");
    }
  );

  // Save to db based on customer Id...
  res.status(200).send("Oauth successful.");
});

router.post("/contacts", async (req, res) => {
  const { phone } = req.body;

  const filePath = path.join(__dirname, "token.json");
  const token = fs.readFileSync(filePath, { encoding: "utf-8" });
  const { accessToken, refreshToken, expirationTime } = JSON.parse(token);

  const response = await getContactByPhoneNumber(
    accessToken,
    refreshToken,
    expirationTime,
    phone
  );

  console.log("hubspot oauth call", response);

  res.status(200).json({ response });
});

module.exports = router;
