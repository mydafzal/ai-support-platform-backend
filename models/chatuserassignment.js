"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatUserAssignment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatUserAssignment.init(
    {},
    {
      sequelize,
      modelName: "ChatUserAssignment",
    }
  );
  return ChatUserAssignment;
};
