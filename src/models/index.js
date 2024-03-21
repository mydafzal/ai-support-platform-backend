const Call = require("./call.model");
const CallGroup = require("./callGroup.model");
const CallGroupMapping = require("./callGroupMapping.model");
const TeamGroup = require("./teamGroup.model");
const TeamMember = require("./teamMember.model");
const User = require("./user.model");
const Url = require("./url.model");
const Document = require("./document.model");
const Assistant = require("./assistant.model");
const Business = require("./business.model");
const Integration = require("./integration.model");
const Chat = require("./chat.model");

Call.belongsTo(User, { foreignKey: "userId" });
CallGroup.belongsTo(User, { foreignKey: "userId" });
TeamGroup.belongsTo(User, { foreignKey: "userId" });
TeamMember.belongsTo(User, { foreignKey: "userId" });
Assistant.belongsTo(User, { foreignKey: "userId" });
Business.belongsTo(User, { foreignKey: "userId" });
Integration.belongsTo(User, { foreignKey: "userId" });
Url.belongsTo(User, { foreignKey: "userId" });
Document.belongsTo(User, { foreignKey: "userId" });
Chat.belongsTo(User, { foreignKey: "userId" });

Call.belongsToMany(CallGroup, {
  through: CallGroupMapping,
  foreignKey: "callId",
});

CallGroup.belongsToMany(Call, {
  through: CallGroupMapping,
  foreignKey: "groupId",
});

CallGroupMapping.belongsTo(Call, { foreignKey: "callId" });
CallGroupMapping.belongsTo(CallGroup, { foreignKey: "groupId" });

TeamMember.belongsTo(TeamGroup, { foreignKey: "teamGroupId" });
TeamGroup.hasMany(TeamMember, { foreignKey: "teamGroupId" });

// User.sync({ force: true });
// Call.sync({ force: true });
// CallGroup.sync({ force: true });
// CallGroupMapping.sync({ force: true });
// TeamGroup.sync({ force: true });
// TeamMember.sync({ force: true });
// Url.sync({ force: true });
// Document.sync({ force: true });
// Assistant.sync({ force: true });
// Business.sync({ force: true });
// Integration.sync({ force: true });
// Chat.sync({ force: true });
