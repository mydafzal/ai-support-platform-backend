const Router = require("express").Router;
const router = Router();

const {
  generateGoogleOAuthUrl,
  storeGoogleOAuthAccessToken,
} = require("../integrations/googleOAuth");

const { getHubSpotAccessToken } = require("../integrations/hubspotCRM");

const moment = require("moment");
const fs = require("fs/promises");
const path = require("path");
const {
  getCalendlyAccessToken,
  getOrganizationMember,
  getCurrentUser,
} = require("../integrations/calendly");

router.get("/google-oauth-url", (req, res) => {
  const oauthUrl = generateGoogleOAuthUrl();
  res.status(200).send(oauthUrl);
});

router.post("/google-oauth-access-token", async (req, res) => {
  const { customerId, code } = req.body;

  await storeGoogleOAuthAccessToken(customerId, code);
  res.status(200).send("OAuth credentials stored.");
});

router.get("/hubspot-auth-url", (req, res) => {
  console.log("process.env.HUBSPOT_AUTH_URL", process.env.HUBSPOT_AUTH_URL);
  return res.status(200).send(process.env.HUBSPOT_AUTH_URL);
});

router.post("/hubspot-access-token", async (req, res) => {
  const { code, redirecUri, customerId } = req.body;

  const response = await getHubSpotAccessToken(code, redirecUri);
  const filePath = path.join(__dirname, "token.json");

  await fs.writeFile(
    filePath,
    JSON.stringify({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expirationTime: moment(new Date())
        .add(response.expiresIn, "seconds")
        .toDate(),
    })
  );

  // Save to db based on customer Id...

  res.status(200).send("Oauth successful.");
});

router.get("/calendly-auth-url", (req, res) => {
  return res.status(200).json({
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.BASE_URL}`,
  });
});

router.post("/calendly-access-token", async (req, res) => {
  const { code, redirecUri, customerId } = req.body;

  const response = await getCalendlyAccessToken(code, redirecUri);

  // Save to db based on customer Id...

  res.status(200).json({ response: response || "OAuth successful." });
});

module.exports = router;
