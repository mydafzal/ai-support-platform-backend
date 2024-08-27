"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BusinessFeature extends Model {
    static associate(models) {
      BusinessFeature.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      BusinessFeature.belongsTo(models.Feature, {
        foreignKey: "featureId",
        as: "feature",
      });
    }
  }
  BusinessFeature.init(
    {
      quantity: { type: DataTypes.STRING },
      usedQuantity: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: "BusinessFeature",
    }
  );
  return BusinessFeature;
};
