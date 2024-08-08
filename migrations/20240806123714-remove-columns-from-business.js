"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Businesses", "stripeCustomerId");
    await queryInterface.removeColumn("Businesses", "adminUserId");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Businesses", "stripeCustomerId", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("Businesses", "adminUserId", {
      type: Sequelize.STRING,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};
