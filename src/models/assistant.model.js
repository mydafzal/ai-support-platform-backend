const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const Assistant = sequelize.define(
  "Assistant",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voice: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    greetingMessageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    farewellMessageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

Assistant.sync({ force: true });

module.exports = Assistant;
