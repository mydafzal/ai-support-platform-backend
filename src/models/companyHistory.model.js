const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Customer = require("./customer.model");

const CompanyHistory = sequelize.define(
  "CompanyHistory",
  {
    section: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {}
);

CompanyHistory.belongsTo(Customer, { foreignKey: "customerId" });

// CompanyHistory.sync({ force: true });

module.exports = CompanyHistory;
