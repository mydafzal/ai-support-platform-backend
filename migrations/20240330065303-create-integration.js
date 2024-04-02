"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Integrations", {
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
      tagline: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      imageUrl: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recommended: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      authUrl: { type: Sequelize.TEXT },
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
    await queryInterface.dropTable("Integrations");
  },
};
