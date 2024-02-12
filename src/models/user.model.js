const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");

const User = sequelize.define(
  "User",
  {
    name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
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

// User.belongsTo(Business, { foreignKey: "businessId" });

// User.sync({ force: true });

module.exports = User;
