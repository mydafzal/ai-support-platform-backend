"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("Subscriptions", "startDate");
    await queryInterface.removeColumn("Subscriptions", "endDate");
    await queryInterface.removeColumn("Subscriptions", "price");
    await queryInterface.removeColumn("Subscriptions", "status");
    await queryInterface.removeColumn("Subscriptions", "billingCycle");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Subscriptions", "startDate", {
      type: Sequelize.DATE,
    });

    await queryInterface.addColumn("Subscriptions", "endDate", {
      type: Sequelize.DATE,
    });

    await queryInterface.addColumn("Subscriptions", "price", {
      type: Sequelize.DECIMAL,
    });

    await queryInterface.addColumn("Subscriptions", "status", {
      type: Sequelize.ENUM("active", "cancelled"),
    });

    await queryInterface.addColumn("Subscriptions", "billingCycle", {
      type: Sequelize.ENUM("monthly", "yearly"),
    });
  },
};
