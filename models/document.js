"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Document extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Document.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });
    }
  }
  Document.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      size: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Document",
    }
  );
  return Document;
};
