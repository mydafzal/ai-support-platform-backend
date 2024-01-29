const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Customer = require("./business.model");

const Assistant = sequelize.define(
  "Assistant",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voice: {
      type: DataTypes.ENUM("Rachel", "Bill", "Daniel", "Antoni", "Glinda"),
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

Assistant.belongsTo(Customer, { foreignKey: "customerId" });

// Assistant.sync({ force: true });

module.exports = Assistant;
