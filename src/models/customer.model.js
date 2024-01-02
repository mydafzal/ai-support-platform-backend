const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");
const Assistant = require("./assistant.model");
const OAuthCredentials = require("./credential.model");

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
    companyHistory: {
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
  },
  {}
);

Customer.hasMany(User);
Customer.hasOne(Assistant);
Customer.hasOne(OAuthCredentials);

Customer.sync({ force: true });

module.exports = Customer;
