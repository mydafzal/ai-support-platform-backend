const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const CallTag = sequelize.define(
  "CallTag",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {}
);

module.exports = CallTag;
