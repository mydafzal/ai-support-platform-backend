const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Business = require("./business.model");

const User = sequelize.define(
  "User",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
    },
    externalId: {
      type: DataTypes.STRING,
    },
    externalType: {
      type: DataTypes.ENUM("Google", "Apple"),
    },
  },
  {}
);

User.belongsTo(Business, { foreignKey: "businessId" });

// User.sync({ force: true });

module.exports = User;
