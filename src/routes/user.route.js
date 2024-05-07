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
const {
  ACCEPTING_CHATS,
  NOT_ACCEPTING_CHATS,
  OFFLINE,
  STORAGE_BASE_PATH,
  PROFILE_IMAGES_BASE_URL,
} = require("../utils/constants");

const path = require("path");

const { v4: uuidv4 } = require("uuid");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `profile-images`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string(),
});

const updateUserValidationSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum([ACCEPTING_CHATS, NOT_ACCEPTING_CHATS, OFFLINE]).optional(),
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
      "email-verification",
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
    console.error("Error adding user: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    let user = await User.findByPk(userId);

    if (user) {
      user = user.toJSON();

      await Invitation.destroy({
        where: {
          email: user.email,
        },
      });

      let business = await Business.findByPk(user.businessId);
      const { name } = business.toJSON();

      let adminUser = await User.findByPk(business.toJSON().adminUserId);
      adminUser = adminUser.toJSON();

      let emailTemplate = `${adminUser.email} removed you from organization ${name}.`;

      await sendEmail(user.email, emailTemplate);

      await User.update(
        {
          businessId: null,
        },
        {
          where: {
            id: userId,
          },
        }
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error updating user: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.patch("/:id", upload.array("file"), async (req, res) => {
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
    if (req.file) {
      const profileImageUrl = `${PROFILE_IMAGES_BASE_URL}/${req.file.filename}`;
      user.profileImageUrl = profileImageUrl;
    }

    await user.save();

    user = user.toJSON();

    if (req.body.phone?.length > 0) {
      await createVerification(
        req.body.phone,
        process.env.TWIML_VERIFY_SERVICE_ID
      );
    }

    if (req.body.email?.length > 0) {
      const emailVerificationToken = generateEmailVerificationToken(user.id);

      await User.update(
        {
          emailVerificationToken,
          emailVerified: false,
        },
        {
          where: {
            id: user.id,
          },
        }
      );

      const emailLink = generateEmailLink(
        req,
        "email-verification",
        `token=${emailVerificationToken}`
      );
      const emailTemplate = `Please verify your email by clicking <a href="${emailLink}">here</a>`;
      await sendEmail(user.email, emailTemplate);
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
      invitation,
    };

    const token = generateJWT(payload);

    res.status(200).json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error("Error updating user: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
