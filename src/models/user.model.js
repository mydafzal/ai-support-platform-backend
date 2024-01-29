// const { DataTypes } = require("sequelize");
// const { sequelize } = require("../loaders/db");
// const Customer = require("./customer.model");

// const User = sequelize.define(
//   "User",
//   {
//     name: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     email: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       unique: true,
//     },
//     phoneNumber: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     callerId: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//   },
//   {}
// );

// User.belongsTo(Customer, { foreignKey: "customerId" });

// // User.sync({ force: true });

// module.exports = User;
