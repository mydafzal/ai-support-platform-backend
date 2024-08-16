"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Business extends Model {
    static associate(models) {
      Business.belongsToMany(models.User, {
        through: models.BusinessMembership,
        foreignKey: "businessId",
        as: "users",
      });

      Business.hasOne(models.Assistant, {
        foreignKey: "businessId",
        as: "assistant",
      });

      Business.hasOne(models.ChatWidget, {
        foreignKey: "businessId",
        as: "chatWidget",
      });

      Business.hasMany(models.Url, { foreignKey: "businessId", as: "urls" });

      Business.hasMany(models.Document, {
        foreignKey: "businessId",
        as: "documents",
      });
      Business.hasMany(models.Call, {
        foreignKey: "businessId",
        as: "calls",
      });

      Business.hasMany(models.CallTag, {
        foreignKey: "businessId",
        as: "callTags",
      });

      Business.hasMany(models.Group, {
        foreignKey: "businessId",
        as: "groups",
      });

      Business.hasMany(models.Invitation, {
        foreignKey: "businessId",
        as: "invitations",
      });

      Business.hasMany(models.BusinessIntegration, {
        foreignKey: "businessId",
        as: "businessIntegrations",
      });

      Business.hasMany(models.Chat, {
        foreignKey: "businessId",
        as: "chats",
      });
    }
  }
  Business.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      twilioNumber: { type: DataTypes.STRING, allowNull: false },
      verifyServiceId: DataTypes.STRING,
      leadMode: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Business",
    }
  );
  return Business;
};
