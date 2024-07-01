"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class PlanFeature extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PlanFeature.init(
    {
      baseQuantity: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "PlanFeature",
    }
  );
  return PlanFeature;
};
