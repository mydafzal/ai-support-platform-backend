const router = require("express").Router();
const { User } = require("../../models");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const { z } = require("zod");
const { redisClient } = require("../integrations/redis");
// const Chat = require("../../models/chat");

const { sendEmail } = require("../integrations/nodemailer");
// const TeamMember = require("../../models/teamMember");
const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4).optional(),
  name: z.string(),
});

router.post("/", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const { success, error } = await userValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (user?.toJSON()?.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists." });
    }

    let hashedPassword;
    if (password?.length > 0) {
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    await User.create({
      name,
      email,
      password: hashedPassword,
    });

    user = await User.findOne({
      where: {
        email,
      },
      attributes: {
        exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
      },
    });

    const emailVerificationToken = generateEmailVerificationToken(
      user.toJSON().id
    );
    user.emailVerificationToken = emailVerificationToken;
    await user.save();

    user = user.toJSON();

    const emailLink = generateEmailLink(
      req,
      "verify-email",
      `token=${emailVerificationToken}`
    );
    const emailTemplate = `Please verify your email by clicking <a href="${emailLink}">here</a>`;
    await sendEmail(user.email, emailTemplate);

    const token = generateJWT(user);

    res.status(201).json({
      success: true,
      data: token,
      message: "Email verification link sent.",
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
