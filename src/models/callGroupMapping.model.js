const { sequelize } = require("../loaders/db");

const CallGroupMapping = sequelize.define("CallGroupMapping", {}, {});

module.exports = CallGroupMapping;
