const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

const Assistant = sequelize.define(
  "Assistant",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voiceName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voiceId: {
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
    knowledgeBaseName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {}
);

Assistant.belongsTo(User, { foreignKey: "userId" });

// Assistant.sync({ force: true });

module.exports = Assistant;
