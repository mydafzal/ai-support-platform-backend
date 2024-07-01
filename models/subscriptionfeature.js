"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SubscriptionFeature extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SubscriptionFeature.init(
    {
      quantity: { type: DataTypes.INTEGER },
    },
    {
      sequelize,
      modelName: "SubscriptionFeature",
    }
  );
  return SubscriptionFeature;
};
