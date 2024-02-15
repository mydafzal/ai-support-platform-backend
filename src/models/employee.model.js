const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Employee = sequelize.define(
  "Employee",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

Employee.belongsTo(User, { foreignKey: "userId" });

// Employee.sync({ force: true });

module.exports = Employee;
