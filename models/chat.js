"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Chat extends Model {
    static associate(models) {
      Chat.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      Chat.belongsTo(models.User, {
        foreignKey: "connectedUserId",
        as: "connectedUser",
      });

      Chat.belongsToMany(models.User, {
        through: models.ChatUserAssignment,
        foreignKey: "chatId",
        as: "users",
      });

      Chat.belongsToMany(models.Group, {
        through: models.ChatGroupAssignment,
        foreignKey: "chatId",
        as: "groups",
      });
    }
  }

  Chat.init(
    {
      title: {
        type: DataTypes.STRING,
      },
      status: {
        type: DataTypes.ENUM("open", "closed", "archived"),
        allowNull: false,
        defaultValue: "open",
      },
    },
    {
      sequelize,
      modelName: "Chat",
    }
  );
  return Chat;
};
