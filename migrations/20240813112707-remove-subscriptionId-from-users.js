"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the foreign key constraint for the subscriptionId column
    await queryInterface.removeConstraint("Users", "Users_subscriptionId_fkey");

    // Remove the subscriptionId column from the Users table
    await queryInterface.removeColumn("Users", "subscriptionId");
  },

  async down(queryInterface, Sequelize) {
    // Add the subscriptionId column back to the Users table
    await queryInterface.addColumn("Users", "subscriptionId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Subscriptions", // The table name where the foreign key is referencing
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Re-add the foreign key constraint
    await queryInterface.addConstraint("Users", {
      fields: ["subscriptionId"],
      type: "foreign key",
      name: "Users_subscriptionId_fkey",
      references: {
        table: "Subscriptions",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  },
};
