"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old foreign key constraint referencing 'Features'
    await queryInterface.removeConstraint("Users", "Users_subscriptionId_fkey");

    // Remove the existing 'subscriptionId' column (if you need to redefine it)
    await queryInterface.changeColumn("Users", "subscriptionId", {
      type: Sequelize.INTEGER,
      allowNull: true, // Adjust this based on your requirements
    });

    // Add a new foreign key constraint to reference 'Subscriptions'
    await queryInterface.addConstraint("Users", {
      fields: ["subscriptionId"],
      type: "foreign key",
      name: "Users_subscriptionId_fkey", // Ensure the name is unique or matches the existing name
      references: {
        table: "Subscriptions",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL", // Adjust this based on your requirements
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the new foreign key constraint referencing 'subscriptions'
    await queryInterface.removeConstraint("Users", "Users_subscriptionId_fkey");

    // Revert the column back to reference 'Features'
    await queryInterface.addConstraint("Users", {
      fields: ["subscriptionId"],
      type: "foreign key",
      name: "Users_subscriptionId_fkey", // Ensure the name matches the old one
      references: {
        table: "Features",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL", // Adjust this based on your requirements
    });
  },
};
