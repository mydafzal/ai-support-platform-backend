const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");

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
      defaultValue: "Bot-handled",
    },
    redirectedTo: {
      type: DataTypes.STRING,
    },
    recordingUrl: {
      type: DataTypes.STRING,
    },
  },
  {}
);

Call.belongsTo(User, { foreignKey: "userId" });

// Call.sync({ force: true });

module.exports = Call;
