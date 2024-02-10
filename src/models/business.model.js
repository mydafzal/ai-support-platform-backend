const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Business = sequelize.define(
  "Business",
  {
    businessName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    twilioNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    verifyServiceId: {
      type: DataTypes.STRING,
    },
  },
  {}
);

Business.belongsTo(User, { foreignKey: "userId" });

// Business.sync({ force: true });

module.exports = Business;
