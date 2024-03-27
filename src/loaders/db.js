const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.POSTGRESDB_NAME,
  process.env.POSTGRESDB_USER,
  process.env.POSTGRESDB_PASSWORD,
  {
    host: "localhost",
    dialect: "postgres",
  }
);

async function connecteToDb() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
}

module.exports = { connecteToDb, sequelize };
