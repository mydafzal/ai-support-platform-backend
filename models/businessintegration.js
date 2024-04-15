"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BusinessIntegration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      BusinessIntegration.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });
      BusinessIntegration.belongsTo(models.Integration, {
        foreignKey: "integrationId",
        as: "integration",
      });
    }
  }
  BusinessIntegration.init(
    {
      accessToken: {
        type: DataTypes.STRING,
      },
      refreshTokenToken: {
        type: DataTypes.STRING,
      },
      expirationTime: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "BusinessIntegration",
    }
  );
  return BusinessIntegration;
};
