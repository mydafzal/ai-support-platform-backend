const { User, Invitation, Business } = require("../../models");

const bcrypt = require("bcrypt");
const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");
const { sendEmail } = require("../integrations/nodemailer");
const SubscriptionService = require("./subscription.service");
const { TEAM_MEMBERS_FEATURE_ID } = require("../utils/constants");
const saltRounds = 10;

async function registerUser(data) {
  const { name, email, password } = data;

  let user = await User.findOne({
    where: {
      email,
    },
    raw: true,
  });

  if (user) {
    throw { statusCode: 400, message: "Email already exists." };
  }

  let invitation = await Invitation.findOne({
    where: {
      email,
    },
    raw: true,
  });

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
    raw: true,
  });

  const emailVerificationToken = generateEmailVerificationToken(user.id);
  user.emailVerificationToken = emailVerificationToken;

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

  const emailLink = generateEmailLink(
    "email-verification",
    `token=${emailVerificationToken}`
  );
  const emailTemplate = `Please verify your email by clicking <a href="${emailLink}">here</a>`;
  await sendEmail(user.email, emailTemplate);

  const payload = { ...user, invitation };
  return generateJWT(payload);
}

async function checkEmailAvailability(data) {
  const { email } = data;

  const count = await User.count({
    where: {
      email,
    },
  });

  return count <= 0;
}

async function updateUser(data) {
  const { userId, name, email, phone, teamGroupId, businessId } = data;

  let user = await User.findByPk(userId, {
    attributes: {
      exclude: ["emailVerificationToken", "resetPasswordToken"],
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  if (businessId || businessId == "") {
    const currentBusinessId = user.businessId;

    user.businessId = businessId === "" ? null : businessId;

    // IF the user is to removed from the organization, then also delete the user's invitation and trigger email to the removed user.
    if (businessId === "") {
      const invitation = await Invitation.findOne({
        where: {
          email: user.email,
        },
        raw: true,
      });

      if (invitation) {
        await Invitation.destroy({
          where: {
            email: user.email,
          },
        });

        const business = await Business.findOne({
          where: {
            id: currentBusinessId,
          },
          raw: true,
        });

        let adminUser = await User.findByPk(business.adminUserId, {
          raw: true,
        });

        if (adminUser) {
          let emailTemplate;

          if (invitation.status === "Pending") {
            emailTemplate = `Your invitation for organization ${name} has been cancelled.`;
          } else {
            emailTemplate = `${adminUser.email} removed you from organization ${name}.`;
          }

          await sendEmail(invitation.email, emailTemplate);
        }
      }
    }
  }

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
          email: user.email,
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

  await User.update(
    {
      ...user,
    },
    {
      where: {
        id: user.id,
      },
    }
  );

  delete user.password;
  delete user.emailVerificationToken;

  return {
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    profileImageUrl: user.profileImageUrl,
  };
}

async function removeUserFromBusiness(data) {
  const { userId } = data;

  let user = await User.findByPk(userId, { raw: true });

  if (user) {
    await Invitation.destroy({
      where: {
        email: user.email,
      },
    });

    let business = await Business.findByPk(user.businessId, {
      raw: true,
    });

    let adminUser = await User.findByPk(business.adminUserId, { raw: true });

    let emailTemplate = `${adminUser.email} removed you from organization ${business.name}.`;
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

    await SubscriptionService.updateFeatureUsage(
      TEAM_MEMBERS_FEATURE_ID,
      business.id,
      -1
    );
  }
}

const UserService = {
  registerUser,
  updateUser,
  checkEmailAvailability,
  removeUserFromBusiness,
};
module.exports = UserService;
