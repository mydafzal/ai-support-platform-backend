"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Assistants", {
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
      voiceName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      voiceId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      greetingMessageUrl: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      farewellMessageUrl: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      greetingMessage: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      farewellMessage: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      knowledgeBaseName: {
        type: Sequelize.STRING,
        allowNull: false,
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
    await queryInterface.dropTable("Assistants");
  },
};
