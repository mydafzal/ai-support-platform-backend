"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TeamGroup extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      TeamGroup.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      TeamGroup.hasMany(models.User, {
        foreignKey: "teamGroupId",
        as: "users",
      });

      TeamGroup.hasMany(models.Invitation, {
        foreignKey: "teamGroupId",
        as: "invitations",
      });

      TeamGroup.belongsToMany(models.Chat, {
        through: models.ChatGroupAssignment,
        foreignKey: "teamGroupId",
      });
    }
  }
  TeamGroup.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      modelName: "TeamGroup",
    }
  );
  return TeamGroup;
};
