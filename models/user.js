"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      User.belongsTo(models.TeamGroup, {
        foreignKey: "teamGroupId",
        as: "teamGroup",
      });

      User.hasOne(models.Business, {
        foreignKey: "adminUserId",
        as: "adminUser",
      });

      User.hasMany(models.Chat, {
        foreignKey: "teamMemberId",
        as: "teamMember",
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
