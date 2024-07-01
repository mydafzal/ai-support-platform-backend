"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class PricingPlan extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      PricingPlan.belongsTo(models.PricingPlan, {
        foreignKey: "basePlanId",
        as: "basePlan",
      });

      PricingPlan.belongsToMany(models.Feature, {
        through: models.PlanFeature,
        foreignKey: "planId",
        as: "features",
      });
    }
  }
  PricingPlan.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tagline: {
        type: DataTypes.TEXT,
      },
      monthlyBasePrice: {
        type: DataTypes.DECIMAL,
        defaultValue: 0,
      },
      yearlyDiscountPercentage: {
        type: DataTypes.DECIMAL,
      },
    },
    {
      sequelize,
      modelName: "PricingPlan",
    }
  );
  return PricingPlan;
};
