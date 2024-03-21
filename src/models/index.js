const Call = require("./call.model");
const CallTag = require("./callTag.model");
// const CallTagMapping = require("./callTagMapping.model");
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
CallTag.belongsTo(User, { foreignKey: "userId" });
TeamGroup.belongsTo(User, { foreignKey: "userId" });
TeamMember.belongsTo(User, { foreignKey: "userId" });
Assistant.belongsTo(User, { foreignKey: "userId" });
Business.belongsTo(User, { foreignKey: "userId" });
Integration.belongsTo(User, { foreignKey: "userId" });
Url.belongsTo(User, { foreignKey: "userId" });
Document.belongsTo(User, { foreignKey: "userId" });
Chat.belongsTo(User, { foreignKey: "userId" });

Call.belongsTo(CallTag, {
  foreignKey: "tagId",
});

CallTag.hasMany(Call, {
  foreignKey: "tagId",
});

// CallTagMapping.belongsTo(Call, { foreignKey: "callId" });
// CallTagMapping.belongsTo(CallTag, { foreignKey: "tagId" });

TeamMember.belongsTo(TeamGroup, { foreignKey: "teamGroupId" });
TeamGroup.hasMany(TeamMember, { foreignKey: "teamGroupId" });

// User.sync({ force: true });
// Call.sync({ force: true });
// CallTag.sync({ force: true });
// CallTagMapping.sync({ force: true });
// TeamGroup.sync({ force: true });
// TeamMember.sync({ force: true });
// Url.sync({ force: true });
// Document.sync({ force: true });
// Assistant.sync({ force: true });
// Business.sync({ force: true });
// Integration.sync({ force: true });
// Chat.sync({ force: true });
