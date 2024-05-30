const router = require("express").Router();
const {
  User,
  Invitation,
  Business,
  ChatUserAssignment,
} = require("../../models");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const { z } = require("zod");

const { sendEmail } = require("../integrations/nodemailer");
const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");

const {
  STORAGE_BASE_PATH,
  PROFILE_IMAGES_BASE_URL,
} = require("../utils/constants");

const path = require("path");
const fs = require("fs");

const { v4: uuidv4 } = require("uuid");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `profile-images`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;

    console.log("uniqueFilename - ", uniqueFilename);

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
  teamGroupId: z.coerce.number().optional().or(z.coerce.string()),
});

const unviewedChatsValidationSchema = z.object({
  viewed: z.coerce.boolean().optional(),
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

router.patch("/:id", upload.single("file"), async (req, res) => {
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
      attributes: {
        exclude: ["emailVerificationToken", "resetPasswordToken"],
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    const { name, email, phone, teamGroupId } = req.body;

    if (phone != undefined) {
      user.phone = phone;
      user.phoneVerified = phone?.length > 0 ? false : true;
    }

    if (name) {
      user.name = name;
    }

    if (teamGroupId || teamGroupId == "") {
      user.teamGroupId = teamGroupId === "" ? null : teamGroupId;

      await Invitation.update(
        {
          teamGroupId: teamGroupId === "" ? null : teamGroupId,
        },
        {
          where: {
            email: user.toJSON().email,
          },
        }
      );
    }

    if (req.file) {
      let profileImageUrl;

      if (user.profileImageUrl) {
        const urlChunks = user.profileImageUrl.split("/");
        const filename = urlChunks[urlChunks.length - 1];

        const existingFilePath = path.join(
          STORAGE_BASE_PATH,
          `profile-images`,
          filename
        );

        const newFilePath = path.join(
          STORAGE_BASE_PATH,
          `profile-images`,
          req.file.filename
        );

        if (fs.existsSync(existingFilePath)) {
          await fs.promises.rm(existingFilePath);
        }

        await fs.promises.rename(newFilePath, existingFilePath);

        profileImageUrl = `${PROFILE_IMAGES_BASE_URL}/${filename}`;
      } else {
        profileImageUrl = `${PROFILE_IMAGES_BASE_URL}/${req.file.filename}`;
      }

      user.profileImageUrl = profileImageUrl;
    }

    if (email?.length > 0) {
      user.email = email;
      user.emailVerified = false;

      await Invitation.update(
        {
          email,
        },
        {
          where: {
            email,
          },
        }
      );
    }

    await user.save();
    user = user.toJSON();

    delete user.password;
    delete user.emailVerificationToken;

    res.status(200).json({
      success: true,
      data: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (error) {
    console.error("Error updating user: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id/chat-assignments", async (req, res) => {
  try {
    const { success } = await unviewedChatsValidationSchema.safeParseAsync(
      req.query
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid query parameters." });
    }

    const { viewed } = req.query;

    let chatAssignmentsCount = await ChatUserAssignment.count({
      where: {
        userId: req.params.id,
        viewed,
      },
    });

    res.status(200).json({
      success: true,
      data: chatAssignmentsCount,
    });
  } catch (error) {
    console.error("Error adding user: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/check-email", async (req, res) => {
  const { email = "" } = req.body;

  try {
    const count = await User.count({
      where: {
        email,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        available: count <= 0,
      },
    });
  } catch (error) {
    console.error("Error checking email availability - ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
