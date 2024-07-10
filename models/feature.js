"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Feature extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

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
