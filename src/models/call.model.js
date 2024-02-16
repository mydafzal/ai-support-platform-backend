const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");
const CallGroup = require("./callGroup.model");

const Call = sequelize.define(
  "Call",
  {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    from: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duration: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.ENUM("Redirected", "Bot-handled"),
    },
    redirectedTo: {
      type: DataTypes.STRING,
    },
    recordingUrl: {
      type: DataTypes.STRING,
    },
    transcription: {
      type: DataTypes.TEXT("long"),
    },
  },
  {}
);

Call.belongsTo(User, { foreignKey: "userId" });

// Call.sync({ force: true });

module.exports = Call;
