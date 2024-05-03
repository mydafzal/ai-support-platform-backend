"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Chat extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
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

      Chat.belongsToMany(models.TeamGroup, {
        through: models.ChatGroupAssignment,
        foreignKey: "chatId",
        as: "teamGroups",
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
