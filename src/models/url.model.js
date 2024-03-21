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


module.exports = Url;
