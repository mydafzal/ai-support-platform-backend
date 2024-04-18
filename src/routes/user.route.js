const router = require("express").Router();
const { User, Invitation, Business, Assistant } = require("../../models");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const { z } = require("zod");

const { sendEmail } = require("../integrations/nodemailer");
const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");
const { createVerification } = require("../controllers/call.controller");

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string(),
});

const updateUserValidationSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
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

    let invitation = await Invitation.findOne({
      where: {
        email,
      },
    });
    invitation = invitation?.toJSON();

    let hashedPassword = await bcrypt.hash(password, saltRounds);

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

    const payload = { ...user, invitation };
    const token = generateJWT(payload);

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

router.patch("/:id", async (req, res) => {
  const userId = req.params.id;
  const { businessId } = req.body;

  try {
    await User.update(
      {
        businessId,
      },
      {
        where: {
          id: userId,
        },
      }
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const { success, error } = await updateUserValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let user = await User.findByPk(userId, {
      include: {
        model: Business,
        as: "business",
        include: [
          {
            model: Assistant,
            as: "assistant",
          },
        ],
      },
      attributes: {
        exclude: ["emailVerificationToken", "resetPasswordToken"],
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    if (req.body.phone) {
      user.phone = req.body.phone;
    }
    if (req.body.name) {
      user.name = req.body.name;
    }

    await user.save();

    user = user.toJSON();

    if (req.body.phone?.length > 0) {
      await createVerification(
        req.body.phone,
        process.env.TWIML_VERIFY_SERVICE_ID
      );
    }

    delete user.password;

    let invitation = await Invitation.findOne({
      where: {
        email: user.email,
      },
    });
    invitation = invitation?.toJSON();

    const payload = {
      ...user,
      invitation: invitation?.status !== "Accepted" ? invitation : null,
    };

    const token = generateJWT(payload);

    res.status(200).json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
