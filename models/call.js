"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Call extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Call.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });
      Call.belongsTo(models.CallTag, {
        foreignKey: "callTagId",
        as: "callTag",
      });
    }
  }
  Call.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
      from: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      duration: {
        type: DataTypes.STRING,
      },
      status: {
        type: DataTypes.ENUM("Redirected", "Bot-handled"),
        defaultValue: "Bot-handled",
      },
      redirectedTo: {
        type: DataTypes.STRING,
      },
      recordingUrl: {
        type: DataTypes.STRING,
      },
      warnings: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
      },
    },
    {
      sequelize,
      modelName: "Call",
    }
  );
  return Call;
};
