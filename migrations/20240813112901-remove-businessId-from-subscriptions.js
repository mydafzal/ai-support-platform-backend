"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the foreign key constraint exists before attempting to remove it
    const tableColumns = await queryInterface.describeTable("Subscriptions");
    const constraints = await queryInterface.showConstraint("Subscriptions");

    const constraintExists = constraints.some(
      (constraint) =>
        constraint.constraintName === "Subscriptions_businessId_fkey"
    );

    if (constraintExists) {
      await queryInterface.removeConstraint(
        "Subscriptions",
        "Subscriptions_businessId_fkey"
      );
    }

    // Remove the businessId column if it exists
    if (tableColumns.businessId) {
      await queryInterface.removeColumn("Subscriptions", "businessId");
    }
  },

  async down(queryInterface, Sequelize) {
    // Add the businessId column back to the Subscriptions table
    await queryInterface.addColumn("Subscriptions", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses", // The table name where the foreign key is referencing
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Re-add the foreign key constraint
    await queryInterface.addConstraint("Subscriptions", {
      fields: ["businessId"],
      type: "foreign key",
      name: "Subscriptions_businessId_fkey",
      references: {
        table: "Businesses",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  },
};
