"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
      Subscription.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });

      Subscription.belongsTo(models.PricingPlan, {
        foreignKey: "planId",
        as: "plan",
      });

      Subscription.hasMany(models.SubscriptionFeature, {
        foreignKey: "subscriptionId",
        as: "subscriptionFeatures",
      });
    }
  }
  Subscription.init(
    {
      stripeSubscriptionId: {
        type: DataTypes.STRING,
      },
    },
    {
      sequelize,
      modelName: "Subscription",
    }
  );
  return Subscription;
};
