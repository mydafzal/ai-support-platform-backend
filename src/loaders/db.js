const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("customer-bot", "hammadfarooq", "rockers@445", {
  host: "localhost",
  dialect: "postgres",
});

async function connecteToDb() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
}

module.exports = { connecteToDb, sequelize };
