const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Integration = sequelize.define(
  "Integrations",
  {
    expirationTime: {
      type: DataTypes.DATE,
      // allowNull: false,
    },
    accessToken: {
      type: DataTypes.TEXT,
      // allowNull: false,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      // allowNull: false,
    },
    name: {
      type: DataTypes.ENUM("Calendly", "Google-OAuth", "HubSpot"),
      allowNull: false,
    },
  },
  {}
);

module.exports = Integration;
