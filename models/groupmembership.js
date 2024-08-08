"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class GroupMembership extends Model {
    static associate(models) {}
  }
  GroupMembership.init(
    {},
    {
      sequelize,
      modelName: "GroupMembership",
    }
  );
  return GroupMembership;
};
