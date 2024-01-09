const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const Customer = sequelize.define(
  "Customer",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
    },
    verifyServiceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

// Customer.sync({ force: true });

module.exports = Customer;
