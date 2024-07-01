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
    }
  }
  Subscription.init(
    {
      billingCycle: {
        type: DataTypes.ENUM("monthly", "yearly"),
        allowNull: false,
      },
      status: { type: DataTypes.ENUM("active", "cancelled"), allowNull: false },
      startDate: {
        type: DataTypes.DATE,
      },
      endDate: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "Subscription",
    }
  );
  return Subscription;
};
