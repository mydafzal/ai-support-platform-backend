const Router = require("express").Router;
const router = Router();

const { getCalendlyAccessToken } = require("../integrations/calendly");
const {
  getGoogleOAuthAccessToken,
  generateGoogleOAuthUrl,
} = require("../integrations/googleOAuth");
const { getHubSpotAccessToken } = require("../integrations/hubspotCRM");
const Integration = require("../models/integration.model");

const moment = require("moment");

const { z } = require("zod");
const accessTokenValidationSchema = z.object({
  code: z.string(),
  redirectUri: z.string().optional(),
  userId: z.number(),
  name: z.enum(["Calendly", "HubSpot", "Google-OAuth"]),
});

router.get("/google-oauth-url", (req, res) => {
  const oauthUrl = generateGoogleOAuthUrl();
  res.status(200).json({ oauthUrl });
});

router.get("/hubspot-auth-url", (req, res) => {
  return res.status(200).json({ hubspotAuthUrl: process.env.HUBSPOT_AUTH_URL });
});

router.get("/calendly-auth-url", (req, res) => {
  return res.status(200).json({
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=http://localhost:5000/`,
  });
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await accessTokenValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { code, redirectUri, name, userId } = req.body;

    let response;

    if (name === "Calendly") {
      response = await getCalendlyAccessToken(code, redirectUri);
    } else if (name === "HubSpot") {
      response = await getHubSpotAccessToken(code, redirectUri);
    } else if (name === "Google-OAuth") {
      response = await getGoogleOAuthAccessToken(code);
    }

    const { accessToken, refreshToken, expiresIn } = response;

    let integration = await Integration.create({
      userId,
      accessToken,
      refreshToken,
      expirationTime: `${moment(new Date())
        .add(expiresIn, "seconds")
        .toDate()}`,
      name,
    });

    integration = integration.toJSON();
    integration = {
      userId: integration.userId,
      name: integration.name,
    };

    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    console.log("Error adding integration: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Integration.destroy({
      where: { id: req.params.id },
    });

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error removing connected integration:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
