"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Group extends Model {
    static associate(models) {
      Group.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      Group.belongsToMany(models.User, {
        through: models.GroupMembership,
        foreignKey: "groupId",
        as: "users",
      });

      Group.hasMany(models.Invitation, {
        foreignKey: "groupId",
        as: "invitations",
      });

      Group.belongsToMany(models.Chat, {
        through: models.ChatGroupAssignment,
        foreignKey: "groupId",
        as: "chats",
      });
    }
  }
  Group.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      modelName: "Group",
    }
  );
  return Group;
};
