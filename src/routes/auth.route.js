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
const { sendEmail } = require("../integrations/nodemailer");

const loginValidationSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(4, "Password must contain at least 4 characters.")
    .optional(),
  externalType: z.enum(["Google", "Apple", ""]),
});

const accessTokenValidationSchema = z.object({
  code: z.string(),
  redirecUri: z.string().optional(),
  userId: z.number(),
});

const emailValidationSchema = z.string().email();
const passwordValidationSchema = z.string().min(4);

router.get("/token", async (req, res) => {
  const { email, password, externalType } = req.body;

  try {
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

    if (!user?.emailVerified) {
      const emailLink = `${req.protocol}://${req.get(
        "host"
      )}/email-verification?token=${user?.emailVerificationToken}`;

      await sendEmail(user?.email, emailLink);

      return res.status(200).json({
        success: false,
        message:
          "Email not verified. A new email verification link has been sent.",
      });
    }

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

    if (!business) {
      return res.status(400).json({
        success: false,
        message: "Please provide business information to complete the signup",
      });
    }

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
  } catch (error) {
    console.log("Error authenticating user...", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const { success, error } = await emailValidationSchema.safeParseAsync(
      email
    );
    if (!success) {
      return res.status(400).json({ success: false, message: error.message });
    }

    let user = await User.findOne({
      where: {
        email,
      },
    });

    user = user?.toJSON();

    if (!user) {
      return res.status(404).json({ success: false, message: "Invalid email" });
    }

    // Generate password reset token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    user.resetPasswordToken = token;
    await user.save();

    const emailLink = `${req.hostname}/setup-passsword?token=${token}`;
    await sendEmail(email, emailLink);

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email.",
    });
  } catch (error) {
    console.log("Error forgot-password", error);
    res.status(200).json({
      success: false,
      message: "Password reset instructions sent to your email.",
    });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const { success, error } = await passwordValidationSchema.safeParseAsync(
      password
    );

    if (!success) {
      return res.status(400).json({ success: false, message: error.message });
    }

    let user = await User.findOne({ where: { resetPasswordToken: token } });
    user = user?.toJSON();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired token." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedToken || decodedToken.userId !== user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired token." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Error occurred while resetting passsword: ", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
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
  try {
    const { success, error } = await accessTokenValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { code, redirecUri, userId } = req.body;

    const response = await getHubSpotAccessToken(code, redirecUri);

    await Integration.create({
      userId,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expirationTime: `${moment(new Date())
        .add(response.expiresIn, "seconds")
        .toDate()}`,
      integrationType: "HubSpot",
    });

    res
      .status(201)
      .json({ success: true, message: "HubSpot integration succesful." });
  } catch (error) {
    console.log("Error storing hubspot access token", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.get("/calendly-auth-url", (req, res) => {
  return res.status(200).json({
    calendlyRedirectUrl: `https://calendly.com/oauth/authorize?client_id=${process.env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=http://localhost:5000/`,
  });
});

router.post("/calendly-access-token", async (req, res) => {
  try {
    const { success, error } = await accessTokenValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { code, redirectUri, userId } = req.body;

    const response = await getCalendlyAccessToken(code, redirectUri);

    await Integration.create({
      userId,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expirationTime: `${moment(new Date())
        .add(response.expires_in, "seconds")
        .toDate()}`,
      integrationType: "Calendly",
    });

    res
      .status(201)
      .json({ success: true, message: "Calendly integration successful." });
  } catch (error) {
    console.log("Error storing hubspot access token", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

module.exports = router;
