"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Invitation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Invitation.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      Invitation.belongsTo(models.TeamGroup, {
        foreignKey: "teamGroupId",
        as: "teamGroup",
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
