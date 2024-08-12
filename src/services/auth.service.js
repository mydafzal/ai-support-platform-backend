const { User, BusinessMembership } = require("../../models");
const { sendEmail } = require("../integrations/nodemailer");
const {
  generateEmailVerificationToken,
  generateEmailLink,
  generateJWT,
} = require("../utils/helpers");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const UserService = require("./user.service");

async function login(data) {
  const { email, password, externalType, name, profileImageUrl } = data;

  let user = await User.findOne({
    where: { email },
    attributes: {
      exclude: ["emailVerificationToken", "resetPasswordToken"],
    },
    raw: true,
  });

  if (externalType === "Google" || externalType === "Apple") {
    if (!user) {
      if (!name) {
        throw { statusCode: 400, message: "Name is required." };
      }

      user = await User.create({
        name,
        email,
        externalType,
        emailVerified: true,
        profileImageUrl,
      });

      user = user.toJSON();

      await UserService.createMembershipsForAcceptedInvitations(
        user.id,
        user.email
      );
    } else if (!user.externalType) {
      throw {
        statusCode: 401,
        message:
          "This is not the authentication method you used during signup.",
      };
    }
  }

  // Email/password authentication
  else {
    if (!user || !password || !user.password) {
      throw { statusCode: 401, message: "Invalid email and/or password." };
    }

    const result = await bcrypt.compare(password, user.password);
    if (!result) {
      throw { statusCode: 401, message: "Invalid email and/or password" };
    }

    if (!user?.emailVerified) {
      const emailVerificationToken = generateEmailVerificationToken(user.id);

      const emailLink = generateEmailLink(
        "email-verification",
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

      const token = generateJWT({ ...user });

      return {
        data: token,
        message:
          "Email not verified. A new email verification link has been sent.",
      };
    }
  }

  delete user.password;
  delete user.emailVerificationToken;
  delete user.resetPasswordToken;

  const businessMemberships = await BusinessMembership.findAll({
    where: {
      userId: user.id,
    },
    attributes: ["businessId", "role"],
    raw: true,
  });

  const payload = {
    ...user,
    businessMemberships,
  };

  return generateJWT(payload);
}

async function generatePasswordResetLink(data) {
  const { email } = data;

  let user = await User.findOne({
    where: {
      email,
    },
    raw: true,
  });

  if (!user) {
    throw {
      statusCode: 401,
      message: "Invalid email",
    };
  } else if (user.externalType) {
    throw {
      statusCode: 401,
      message:
        "Password cannot be reset for the authentication method you used during signup.",
    };
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  await User.update(
    {
      resetPasswordToken: token,
    },
    {
      where: {
        email,
      },
    }
  );

  const emailLink = generateEmailLink("setup-password", `token=${token}`);
  const emailTemplate = `Reset your password by clicking <a href="${emailLink}">here</a>`;
  await sendEmail(email, emailTemplate);
}

async function resetPassword(data) {
  const { token, password } = data;

  let user = await User.findOne({
    where: { resetPasswordToken: token },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 400, message: "Invalid or expired token." };
  }

  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

  if (!decodedToken || decodedToken.userId !== user.id) {
    throw { statusCode: 400, message: "Invalid or expired token." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.update(
    {
      password: hashedPassword,
      resetPasswordToken: null,
    },
    {
      where: {
        id: user.id,
      },
    }
  );
}

async function verifyEmail(data) {
  const { token } = data;

  if (!token) {
    throw { statusCode: 400, message: "Invalid or expired token." };
  }

  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

  let user = await User.findByPk(decodedToken.userId, {
    attributes: {
      exclude: ["resetPasswordToken", "password"],
    },
    raw: true,
  });

  if (!user || user.emailVerificationToken !== token) {
    throw { statusCode: 400, message: "Invalid or expired token." };
  }

  await User.update(
    {
      emailVerified: true,
      emailVerificationToken: null,
    },
    {
      where: {
        id: user.id,
      },
    }
  );

  delete user.emailVerificationToken;

  const businessMemberships = await BusinessMembership.findAll({
    where: {
      userId: user.id,
    },
    attributes: ["businessId"],
    raw: true,
  });

  const payload = {
    ...user,
    businessMemberships,
  };

  return generateJWT(payload);
}

async function resendEmailVerificationLink(data) {
  const { email, redirectUri } = data;

  let user = await User.findOne({
    where: {
      email,
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 400, message: "Invalid email" };
  }

  if (user.emailVerified) {
    throw { statusCode: 400, message: "User is already verified." };
  }

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

  const emailLink = generateEmailLink(
    "email-verification",
    `token=${emailVerificationToken}&redirectUri=${redirectUri}`
  );

  const emailTemplate = `Please verify your email by clicking <a href=${emailLink}>here</a>`;
  await sendEmail(email, emailTemplate);
}

const AuthService = {
  login,
  generatePasswordResetLink,
  resetPassword,
  verifyEmail,
  resendEmailVerificationLink,
};

module.exports = AuthService;
