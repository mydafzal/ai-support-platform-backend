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
        as: "admin",
      });
      Business.hasOne(models.Assistant, {
        foreignKey: "businessId",
        as: "assistant",
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
      // Business.hasMany(models.BusinessMembership, {
      //   foreignKey: "businessId",
      //   as: "memberships",
      // });

      Business.belongsToMany(models.User, {
        through: "BusinessMembership",
        foreignKey: "businessId",
      });

      Business.hasMany(models.TeamGroup, {
        foreignKey: "businessId",
        as: "teamGroups",
      });
    }
  }
  Business.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      twilioNumber: { type: DataTypes.STRING, allowNull: false },
      verifyServiceId: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Business",
    }
  );
  return Business;
};
