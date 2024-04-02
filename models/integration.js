"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Integration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Integration.hasMany(models.BusinessIntegration, {
        foreignKey: "integrationId",
        as: "integration",
      });
    }
  }
  Integration.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      tagline: { type: DataTypes.STRING, allowNull: false },
      imageUrl: { type: DataTypes.STRING, allowNull: false },
      recommended: { type: DataTypes.BOOLEAN, defaultValue: false },
      authUrl: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: "Integration",
    }
  );
  return Integration;
};
