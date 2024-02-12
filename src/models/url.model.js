const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Url = sequelize.define(
  "Url",
  {
    link: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

Url.belongsTo(User, { foreignKey: "userId" });

// Url.sync({ force: true });

module.exports = Url;
