const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Business = require("./business.model");

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
    integrationType: {
      type: DataTypes.ENUM("Calendly", "Google-OAuth", "HubSpot"),
      allowNull: false,
    },
  },
  {}
);

Integration.belongsTo(Business, { foreignKey: "businessId" });

// Integration.sync({ force: true });

module.exports = Integration;
