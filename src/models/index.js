const Call = require("./call.model");
const CallGroup = require("./callGroup.model");
const CallGroupMapping = require("./callGroupMapping.model");

Call.belongsToMany(CallGroup, {
  through: CallGroupMapping,
  foreignKey: "callId",
});
CallGroup.belongsToMany(Call, {
  through: CallGroupMapping,
  foreignKey: "groupId",
});

// Call.sync({ force: true });
// CallGroup.sync({ force: true });
// CallGroupMapping.sync({ force: true });
