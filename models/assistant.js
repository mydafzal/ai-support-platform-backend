"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Assistant extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Assistant.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });
    }
  }
  Assistant.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      voiceName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      voiceId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      greetingMessageUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      farewellMessageUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      greetingMessage: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      farewellMessage: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      knowledgeBaseName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Assistant",
    }
  );
  return Assistant;
};
