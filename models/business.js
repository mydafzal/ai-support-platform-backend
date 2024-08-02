"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Business extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Business.belongsTo(models.User, {
        foreignKey: "adminUserId",
        as: "adminUser",
      });

      Business.hasMany(models.User, {
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

      Business.hasMany(models.TeamGroup, {
        foreignKey: "businessId",
        as: "teamGroups",
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

      Business.hasOne(models.Subscription, {
        foreignKey: "businessId",
        as: "subscription",
      });
    }
  }
  Business.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      twilioNumber: { type: DataTypes.STRING, allowNull: false },
      verifyServiceId: DataTypes.STRING,
      stripeCustomerId: DataTypes.STRING,
      leadMode: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Business",
    }
  );
  return Business;
};
