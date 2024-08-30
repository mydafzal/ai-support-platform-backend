"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "subscriptionId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Features",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Users", "stripeCustomerId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Features",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "subscriptionId");
    await queryInterface.removeColumn("Users", "stripeCustomerId");
  },
};
