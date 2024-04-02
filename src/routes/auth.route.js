const Router = require("express").Router;
const router = Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  User,
  Business,
  Assistant,
  BusinessMembership,
} = require("../../models");

const { z } = require("zod");
const { sendEmail } = require("../integrations/nodemailer");

const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");

const loginValidationSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z
    .string()
    .min(4, "Password must contain at least 4 characters.")
    .optional(),
  externalType: z.enum(["Google", "Apple", ""]),
});

const emailValidationSchema = z.string().email();
const passwordValidationSchema = z.string().min(4);

router.post("/login", async (req, res) => {
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

    const { email, password, externalType, name } = req.body;

    let user = await User.findOne({
      where: { email },
      attributes: {
        exclude: ["emailVerificationToken", "resetPasswordToken"],
      },
    });

    // Social authentication
    if (externalType === "Google" || externalType === "Apple") {
      if (!user) {
        if (!name) {
          return res.status(400).json({
            success: false,
            message: "Name is required.",
          });
        }

        user = await User.create({
          name,
          email,
          externalType,
          emailVerified: true,
        });
      } else if (!user.toJSON().externalType) {
        return res.status(400).json({
          success: false,
          message:
            "This is not the authentication method you used during signup.",
        });
      }

      user = user.toJSON();
    }

    // Perform email/password authentication
    else {
      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email and/or password." });
      }

      user = user.toJSON();

      if (!user?.emailVerified) {
        const emailVerificationToken = generateEmailVerificationToken(user.id);

        const emailLink = generateEmailLink(
          req,
          "verify-email",
          `token=${emailVerificationToken}`
        );

        const emailTemplate = `Please verify your email by clicking <a href="${emailLink}">here</a>`;

        await sendEmail(user?.email, emailTemplate);

        await User.update(
          {
            emailVerificationToken,
          },
          {
            where: {
              id: user.id,
            },
          }
        );

        return res.status(200).json({
          success: false,
          message:
            "Email not verified. A new email verification link has been sent.",
        });
      }

      const result = await bcrypt.compare(password, user.password);
      if (!result) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email and/or password" });
      }
    }

    delete user.password;

    let businessMemberships = await BusinessMembership.findAll({
      where: {
        userId: user.id,
      },
      include: [
        {
          model: Business,
          as: "business",
          include: [{ model: Assistant, as: "assistant" }],
        },
      ],
    });

    businessMemberships = businessMemberships.map((item) => item.toJSON());

    const payload = {
      ...user,
      businessMemberships,
    };

    const token = generateJWT(payload);
    return res.status(200).json({ success: true, data: token });
  } catch (error) {
    console.error("Error during login:", error);
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

    if (!user) {
      return res.status(404).json({ success: false, message: "Invalid email" });
    } else if (user.toJSON().externalType) {
      return res.status(404).json({
        success: false,
        message:
          "Password cannot be reset for the authentication method you used during signup.",
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    user.resetPasswordToken = token;
    await user.save();

    const emailLink = generateEmailLink(
      req,
      "setup-password",
      `token=${token}`
    );
    const emailTemplate = `Reset your password by clicking <a href="${emailLink}">here</a>`;
    await sendEmail(email, emailTemplate);

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email.",
    });
  } catch (error) {
    console.log("Error forgot-password", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
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

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired token." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedToken || decodedToken.userId !== user.toJSON().id) {
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

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    console.log("token ", token);

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid token" });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    console.log("decodedToken.userId", decodedToken.userId);

    let user = await User.findByPk(decodedToken.userId, {
      attributes: {
        exclude: ["resetPasswordToken", "password"],
      },
    });

    if (!user?.toJSON() || user?.toJSON().emailVerificationToken !== token) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    user = user.toJSON();
    delete user.emailVerificationToken;

    let businessMemberships = await BusinessMembership.findAll({
      where: {
        userId: decodedToken.userId,
      },
      include: [
        {
          model: Business,
          as: "business",
          include: [{ model: Assistant, as: "assistant" }],
        },
      ],
    });

    businessMemberships = businessMemberships.map((item) => item.toJSON());

    const payload = {
      ...user,
      businessMemberships,
    };

    const authToken = generateJWT(payload);

    res.status(200).json({
      success: true,
      data: authToken,
      message: "Email verified successfully",
    });
  } catch (err) {
    console.error("Error verifying email:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/resend-verification-email", async (req, res) => {
  try {
    const { email } = req.body;

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist." });
    }

    if (user.toJSON().emailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "User is already verified." });
    }

    const emailVerificationToken = generateEmailVerificationToken(
      user.toJSON().id
    );

    user.emailVerificationToken = emailVerificationToken;
    await user.save();

    const emailLink = generateEmailLink(
      req,
      "verify-email",
      `token=${emailVerificationToken}`
    );
    const emailTemplate = `Please verify your email by clicking <a href=${emailLink}>here</a>`;

    await sendEmail(email, emailTemplate);

    res
      .status(200)
      .json({ success: true, message: "Verification email resent" });
  } catch (err) {
    console.error("Error verifying email:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
