"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class IntegrationWarning extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      IntegrationWarning.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });
      IntegrationWarning.belongsTo(models.Integration, {
        foreignKey: "integrationId",
        as: "integration",
      });
    }
  }
  IntegrationWarning.init(
    {
      lastEmailSentAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "IntegrationWarning",
    }
  );
  return IntegrationWarning;
};
