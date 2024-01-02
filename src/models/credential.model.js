const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const OAuthCredentials = sequelize.define(
  "OAuthCredentials",
  {
    accessToken: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiryDate: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  },
  {}
);

module.exports = OAuthCredentials;
