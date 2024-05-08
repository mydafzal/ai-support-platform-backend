const Router = require("express").Router;
const router = Router();

const { getCalendlyAccessToken } = require("../integrations/calendly");
const {
  getGoogleOAuthAccessToken,
  generateGoogleOAuthUrl,
  revokeAccessToken,
} = require("../integrations/googleOAuth");
const { getHubSpotAccessToken } = require("../integrations/hubspotCRM");

const { Integration, BusinessIntegration } = require("../../models");

const moment = require("moment");

const { z } = require("zod");
const accessTokenValidationSchema = z.object({
  code: z.string(),
  redirectUri: z.string().optional(),
  businessId: z.number(),
  integrationId: z.number(),
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
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.REDIRECT_URI}`,
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

    const { code, redirectUri, integrationId, businessId } = req.body;

    let integration = await Integration.findByPk(integrationId);

    if (!integration) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid integration id" });
    }

    integration = integration.toJSON();

    let response;
    if (integration.name === "Calendly") {
      response = await getCalendlyAccessToken(code, redirectUri);
    } else if (integration.name === "HubSpot") {
      response = await getHubSpotAccessToken(code, redirectUri);
    } else if (integration.name === "Google Calendar") {
      response = await getGoogleOAuthAccessToken(decodeURIComponent(code));
    }

    const { accessToken, refreshToken, expiresIn } = response;

    let businessIntegration = await BusinessIntegration.create({
      businessId,
      accessToken,
      refreshToken,
      expirationTime: `${moment(new Date())
        .add(expiresIn, "seconds")
        .toDate()}`,
      integrationId,
    });

    businessIntegration = businessIntegration.toJSON();

    integration.connected = true;
    integration.businessIntegrationId = businessIntegration.id;
    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    console.log("Error adding integration: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.delete("/:id", async (req, res) => {
  const businessIntegrationId = req.params.id;

  try {
    let businessIntegration = await BusinessIntegration.findByPk(
      businessIntegrationId
    );

    if (businessIntegration) {
      businessIntegration = businessIntegration?.toJSON();
      await revokeAccessToken(businessIntegration.accessToken);
    }

    await BusinessIntegration.destroy({
      where: { id: businessIntegrationId },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error removing connected integration:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
