"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BusinessMembership extends Model {
    static associate(models) {}
  }
  BusinessMembership.init(
    {
      role: DataTypes.ENUM("Admin", "TeamMember"),
    },
    {
      sequelize,
      modelName: "BusinessMembership",
    }
  );
  return BusinessMembership;
};
