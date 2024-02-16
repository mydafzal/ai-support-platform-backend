const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Call = require("./call.model");
const CallGroup = require("./callGroup.model");

const CallGroupMapping = sequelize.define("CallGroupMapping", {}, {});

// CallGroupMapping.belongsTo(Call, { foreignKey: "callId" });
// CallGroupMapping.belongsTo(CallGroup, { foreignKey: "groupId" });

// CallGroupMapping.sync({ force: true });

module.exports = CallGroupMapping;
