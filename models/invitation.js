"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Invitation extends Model {
    static associate(models) {
      Invitation.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      Invitation.belongsTo(models.Group, {
        foreignKey: "groupId",
        as: "group",
      });
    }
  }
  Invitation.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      token: DataTypes.STRING,
      status: DataTypes.ENUM("Pending", "Accepted"),
    },
    {
      sequelize,
      modelName: "Invitation",
    }
  );
  return Invitation;
};
