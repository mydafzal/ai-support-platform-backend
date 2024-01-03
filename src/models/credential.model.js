const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Customer = require("./customer.model");

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

OAuthCredentials.belongsTo(Customer, { foreignKey: "customerId" });

// OAuthCredentials.sync({ force: true });

module.exports = OAuthCredentials;
