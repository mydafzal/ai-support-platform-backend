const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Chat = sequelize.define(
  "Chat",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

Chat.belongsTo(User, { foreignKey: "userId" });

// Chat.sync({ force: true });

module.exports = Chat;
