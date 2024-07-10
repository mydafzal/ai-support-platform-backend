"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Subscription.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
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
