const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const TeamGroup = sequelize.define(
  "TeamGroup",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

module.exports = TeamGroup;
