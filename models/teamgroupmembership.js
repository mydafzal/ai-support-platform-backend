"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TeamGroupMembership extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TeamGroupMembership.init(
    {
      // userId: DataTypes.INTEGER,
      // teamGroupId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "TeamGroupMembership",
    }
  );
  return TeamGroupMembership;
};
