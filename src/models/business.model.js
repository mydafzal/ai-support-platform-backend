const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

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
    phoneNumbers: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      // allowNull: false,
      validate: {
        isArray: true,
      },
    },
    verifyServiceId: {
      type: DataTypes.STRING,
    },
  },
  {}
);

// Business.sync({ force: true });

module.exports = Business;
