const Router = require("express").Router;
const router = Router();

const moment = require("moment");

const {
  generateGoogleOAuthUrl,
  storeGoogleOAuthAccessToken,
} = require("../integrations/googleOAuth");
const { getHubSpotAccessToken } = require("../integrations/hubspotCRM");
const { getCalendlyAccessToken } = require("../integrations/calendly");
const Integration = require("../models/integration.model");

router.get("/google-oauth-url", (req, res) => {
  const oauthUrl = generateGoogleOAuthUrl();
  res.status(200).json({ oauthUrl });
});

router.post("/google-oauth-access-token", async (req, res) => {
  const { businessId, code } = req.body;

  const response = await storeGoogleOAuthAccessToken(code);

  await Integration.create({
    businessId,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expirationTime: response.expiry_date,
  });

  res.status(200).json({ message: "Google OAuth integration successful." });
});

router.get("/hubspot-auth-url", (req, res) => {
  return res.status(200).json({ hubspotAuthUrl: process.env.HUBSPOT_AUTH_URL });
});

router.post("/hubspot-access-token", async (req, res) => {
  const { code, redirecUri, businessId } = req.body;

  const response = await getHubSpotAccessToken(code, redirecUri);

  await Integration.create({
    businessId,
    accessToken: response.accessToken,
    accessToken: response.refreshToken,
    expirationTime: moment(new Date())
      .add(response.expiresIn, "seconds")
      .toDate(),
    integrationType: "HubSpot",
  });

  res.status(200).json({ message: "HubSpot integration succesful." });
});

router.get("/calendly-auth-url", (req, res) => {
  return res.status(200).json({
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.BASE_URL}`,
  });
});

router.post("/calendly-access-token", async (req, res) => {
  const { code, redirecUri, businessId } = req.body;

  const response = await getCalendlyAccessToken(code, redirecUri);

  await Integration.create({
    businessId,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expirationTime: moment(new Date())
      .add(response.expires_in, "seconds")
      .toDate(),
    integrationType: "Calendly",
  });

  res.status(200).json({ message: "Calendly integration successful." });
});

module.exports = router;
