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
      User.hasOne(models.Business, {
        foreignKey: "adminUserId",
        as: "adminBusiness",
      });

      User.belongsToMany(models.Business, {
        through: "BusinessMembership",
        foreignKey: "userId",
        as: "businesses",
      });
      User.belongsToMany(models.TeamGroup, {
        through: "TeamGroupMembership",
        foreignKey: "userId",
        as: "teamGroups",
      });
    }
  }
  User.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: { type: DataTypes.STRING },
      externalType: { type: DataTypes.ENUM("Google", "Apple") },
      emailVerified: { type: DataTypes.BOOLEAN },
      emailVerificationToken: { type: DataTypes.STRING },
      resetPasswordToken: { type: DataTypes.STRING },
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
