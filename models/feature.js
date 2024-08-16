"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Feature extends Model {
    static associate(models) {
      Feature.belongsToMany(models.PricingPlan, {
        through: models.PlanFeature,
        foreignKey: "featureId",
        as: "plans",
      });

      Feature.hasMany(models.SubscriptionFeature, {
        foreignKey: "featureId",
        as: "subscriptionFeatures",
      });
    }
  }
  Feature.init(
    {
      nameSingular: { type: DataTypes.STRING },
      namePlural: { type: DataTypes.STRING },
      unitPrice: {
        type: DataTypes.DECIMAL,
      },
    },
    {
      sequelize,
      modelName: "Feature",
    }
  );
  return Feature;
};
