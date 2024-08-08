"use strict";
const { Model } = require("sequelize");
const {
  ACCEPTING_CHATS,
  NOT_ACCEPTING_CHATS,
  OFFLINE,
} = require("../src/utils/constants");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsToMany(models.Business, {
        through: models.BusinessMembership,
        foreignKey: "userId",
        as: "businesses",
      });

      User.belongsToMany(models.Group, {
        through: models.GroupMembership,
        foreignKey: "userId",
        as: "groups",
      });

      User.belongsToMany(models.Chat, {
        through: models.ChatUserAssignment,
        foreignKey: "userId",
      });
    }
  }
  User.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: DataTypes.STRING,
      },
      password: { type: DataTypes.STRING },
      externalType: { type: DataTypes.ENUM("Google", "Apple") },
      emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
      phoneVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
      emailVerificationToken: { type: DataTypes.STRING },
      resetPasswordToken: { type: DataTypes.STRING },
      profileImageUrl: { type: DataTypes.STRING },
      role: {
        type: DataTypes.STRING,
      },
      status: {
        type: DataTypes.ENUM(ACCEPTING_CHATS, NOT_ACCEPTING_CHATS, OFFLINE),
        defaultValue: ACCEPTING_CHATS,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
