"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: Sequelize.STRING,
      },
      password: { type: Sequelize.STRING },
      externalType: { type: Sequelize.ENUM("Google", "Apple") },
      emailVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      phoneVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      emailVerificationToken: { type: Sequelize.STRING },
      resetPasswordToken: { type: Sequelize.STRING },
      profileImageUrl: { type: Sequelize.STRING },
      role: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Users");
  },
};
