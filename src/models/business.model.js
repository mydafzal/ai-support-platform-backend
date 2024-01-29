const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const Business = sequelize.define(
  "Business",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    twilioNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumbers: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        isArray: true,
      },
    },
    verifyServiceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

// Business.sync({ force: true });

module.exports = Business;
