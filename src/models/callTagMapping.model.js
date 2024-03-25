const { sequelize } = require("../loaders/db");

const CallTagMapping = sequelize.define("CallTagMapping", {}, {});

module.exports = CallTagMapping;
