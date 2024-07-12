"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("SubscriptionFeatures", "quantity", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("SubscriptionFeatures", "quantity", {
      type: Sequelize.INTEGER,
    });
  },
};
