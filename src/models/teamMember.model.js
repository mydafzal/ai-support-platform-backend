const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");
const TeamGroup = require("./teamGroup.model");

const TeamMember = sequelize.define(
  "TeamMember",
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

TeamMember.belongsTo(User, { foreignKey: "userId" });
TeamMember.belongsTo(TeamGroup, { foreignKey: "teamGroupId" });

// TeamMember.sync({ force: true });

module.exports = TeamMember;
