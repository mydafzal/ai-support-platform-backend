const { DataTypes, Sequelize } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");
// const Call = require("./call.model");

const CallGroup = sequelize.define(
  "CallGroup",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {}
);

module.exports = CallGroup;
