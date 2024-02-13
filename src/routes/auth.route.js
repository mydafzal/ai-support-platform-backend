const Router = require("express").Router;
const router = Router();

const moment = require("moment");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  generateGoogleOAuthUrl,
  storeGoogleOAuthAccessToken,
} = require("../integrations/googleOAuth");
const { getHubSpotAccessToken } = require("../integrations/hubspotCRM");
const { getCalendlyAccessToken } = require("../integrations/calendly");

const Integration = require("../models/integration.model");
const User = require("../models/user.model");
const Business = require("../models/business.model");
const Assistant = require("../models/assistant.model");

const { z } = require("zod");

const loginValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  externalType: z.enum(["Google", "Apple", ""]),
});

router.post("/token", async (req, res) => {
  const { email, password, externalType } = req.body;

  const { success, error } = await loginValidationSchema.safeParseAsync(
    req.body
  );

  if (!success) {
    return res.status(400).json({
      success: false,
      message: error.errors[0].message,
    });
  }

  let user = await User.findOne({
    where: {
      email,
    },
  });

  if (!user) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid email and/or password." });
  }

  user = user.toJSON();

  if (externalType !== "Google" && externalType !== "Apple") {
    const result = await bcrypt.compare(password, user.password);

    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email and/or password" });
    }
  }

  delete user.password;

  let business = await Business.findOne({
    where: {
      userId: user.id,
    },
  });

  business = business.toJSON();

  let assistant = await Assistant.findOne({
    where: {
      userId: user.id,
    },
  });

  assistant = assistant.toJSON();

  const token = jwt.sign(
    { user, business, assistant },
    process.env.JWT_SECRET,
    {
      expiresIn: 86400,
    }
  );

  res.status(200).json({
    success: true,
    data: token,
  });
});

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
    refreshToken: response.refreshToken,
    expirationTime: `${moment(new Date())
      .add(response.expiresIn, "seconds")
      .toDate()}`,
    integrationType: "HubSpot",
  });

  res.status(200).json({ message: "HubSpot integration succesful." });
});

router.get("/calendly-auth-url", (req, res) => {
  return res.status(200).json({
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=http://localhost:5000/`,
  });
});

router.post("/calendly-access-token", async (req, res) => {
  const { code, redirectUri, businessId } = req.body;

  const response = await getCalendlyAccessToken(code, redirectUri);

  await Integration.create({
    businessId,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expirationTime: `${moment(new Date())
      .add(response.expires_in, "seconds")
      .toDate()}`,
    integrationType: "Calendly",
  });

  res.status(200).json({ message: "Calendly integration successful." });
});

module.exports = router;
