"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BusinessMembership extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      BusinessMembership.belongsTo(models.Business, {
        foreignKey: "businessId",
        as: "business",
      });

      BusinessMembership.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }
  BusinessMembership.init(
    {
      role: { type: DataTypes.ENUM("Admin", "TeamMember"), allowNull: false },
      // businessId: {
      //   type: DataTypes.INTEGER,
      //   references: {
      //     model: "Business",
      //     key: "id",
      //   },
      // },
      // userId: {
      //   type: DataTypes.INTEGER,
      //   references: {
      //     model: "User",
      //     key: "id",
      //   },
      // },
    },
    {
      sequelize,
      modelName: "BusinessMembership",
    }
  );
  return BusinessMembership;
};
