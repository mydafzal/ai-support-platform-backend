const fs = require("fs");
const path = require("path");

const {
  User,
  Invitation,
  Business,
  BusinessMembership,
  Group,
} = require("../../models");

const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");
const { sendEmail } = require("../integrations/nodemailer");

const SubscriptionService = require("./subscription.service");
const {
  TEAM_MEMBERS_FEATURE_ID,
  STORAGE_BASE_PATH,
  PROFILE_IMAGES_BASE_URL,
} = require("../utils/constants");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const sequelize = require("sequelize");

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

  const businessMemberships = await createMembershipsForAcceptedInvitations(
    user.id,
    user.email
  );

  const emailLink = generateEmailLink(
    "email-verification",
    `token=${emailVerificationToken}`
  );
  const emailTemplate = `Please verify your email by clicking <a href="${emailLink}">here</a>`;
  await sendEmail(user.email, emailTemplate);

  return generateJWT({ ...user, businessMemberships });
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
  const { userId, name, email, phone, file } = data;

  let user = await User.findByPk(userId, {
    attributes: {
      exclude: ["password", "emailVerificationToken", "resetPasswordToken"],
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  if (phone != undefined) {
    user.phone = phone;
    user.phoneVerified = phone?.length > 0 ? false : true;
  }

  if (name) {
    user.name = name;
  }

  if (file) {
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
        file.filename
      );

      if (fs.existsSync(existingFilePath)) {
        await fs.promises.rm(existingFilePath);
      }

      await fs.promises.rename(newFilePath, existingFilePath);

      profileImageUrl = `${PROFILE_IMAGES_BASE_URL}/${filename}`;
    } else {
      profileImageUrl = `${PROFILE_IMAGES_BASE_URL}/${file.filename}`;
    }

    user.profileImageUrl = profileImageUrl;
  }

  if (email?.length > 0) {
    user.email = email;
    user.emailVerified = false;
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

async function getUsersByBusiness(data) {
  const { businessId } = data;

  const businessWithUsers = await Business.findOne({
    where: { id: businessId },
    include: [
      {
        model: User,
        as: "users",
        attributes: {
          exclude: [
            "password",
            "emailVerificationToken",
            "resetPasswordToken",
            "externalType",
          ],
        },
        through: {
          attributes: [],
        },
        include: [
          {
            model: Group,
            as: "groups",
            attributes: ["name", "id"],
            through: {
              attributes: [],
            },
            where: { businessId },
            required: false,
          },
        ],
      },
    ],
  });

  let users = businessWithUsers.toJSON().users;

  users = users.map((user) => {
    user.group = user.groups[0];
    delete user.groups;

    return user;
  });

  let whereCondition = {
    businessId,
  };

  if (users?.length > 0) {
    whereCondition.email = {
      [sequelize.Op.notIn]: users.map((user) => user.email),
    };
  }

  let invitations = await Invitation.findAll({
    where: whereCondition,
    attributes: {
      exclude: ["token", "groupId"],
    },
    include: [
      {
        model: Group,
        as: "group",
        attributes: ["name", "id"],
        required: false,
      },
    ],
    raw: true,
    nest: true,
  });

  invitations = invitations.map((invitation) => ({
    ...invitation,
    group: invitation.group.name ? invitation.group : undefined, // Remove the group property if it's null
  }));

  return [...users, ...invitations];
}

// If a user has accepted invitations of companies before signing up, then as the user signs up, they become member of the companies they accepted invitations for.
async function createMembershipsForAcceptedInvitations(userId, email) {
  const invitations = await Invitation.findAll({
    where: {
      email,
      status: "Accepted",
    },
    raw: true,
  });

  let businessMemberships = [];

  if (invitations) {
    businessMemberships = invitations.map((invitation) => ({
      businessId: invitation.businessId,
      userId,
      role: "TeamMember",
    }));

    await BusinessMembership.bulkCreate(businessMemberships);

    businessMemberships.forEach((membership) => {
      delete membership.userId;
    });
  }

  return businessMemberships;
}

async function getBusinessesOfUser(data) {
  const { userId } = data;

  const user = await User.findOne({
    where: {
      id: userId,
    },
    include: [
      {
        model: Business,
        as: "businesses",
        attributes: ["id", "name", "twilioNumber"],
        through: {
          attributes: [],
        },
      },
    ],
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id" };
  }

  return user.toJSON().businesses;
}

async function getMembershipsOfUser(data) {
  const { userId } = data;

  return await BusinessMembership.findAll({
    where: {
      userId,
    },
    raw: true,
  });
}

const UserService = {
  registerUser,
  updateUser,
  checkEmailAvailability,
  removeUserFromBusiness,
  getUsersByBusiness,
  createMembershipsForAcceptedInvitations,
  getBusinessesOfUser,
  getMembershipsOfUser,
};
module.exports = UserService;
