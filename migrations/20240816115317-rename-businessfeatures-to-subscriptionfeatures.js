"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename the table from "BusinessFeatures" to "SubscriptionFeatures"
    await queryInterface.renameTable(
      "BusinessFeatures",
      "SubscriptionFeatures"
    );

    // Rename the column from "businessId" to "subscriptionId"
    await queryInterface.renameColumn(
      "SubscriptionFeatures",
      "businessId",
      "subscriptionId"
    );

    // Remove the existing foreign key constraint on the "businessId" column
    await queryInterface.removeConstraint(
      "SubscriptionFeatures",
      "BusinessFeatures_businessId_fkey"
    );

    // Add a new foreign key constraint on the renamed "subscriptionId" column
    await queryInterface.addConstraint("SubscriptionFeatures", {
      fields: ["subscriptionId"],
      type: "foreign key",
      name: "SubscriptionFeatures_subscriptionId_fkey",
      references: {
        table: "Subscriptions", // Name of the table it references
        field: "id", // Column in the referenced table
      },
      onDelete: "CASCADE", // Action on delete
      onUpdate: "CASCADE", // Action on update
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the foreign key constraint on the "subscriptionId" column
    await queryInterface.removeConstraint(
      "SubscriptionFeatures",
      "SubscriptionFeatures_subscriptionId_fkey"
    );

    // Rename the column back from "subscriptionId" to "businessId"
    await queryInterface.renameColumn(
      "SubscriptionFeatures",
      "subscriptionId",
      "businessId"
    );

    // Add the original foreign key constraint back on the "businessId" column
    await queryInterface.addConstraint("SubscriptionFeatures", {
      fields: ["businessId"],
      type: "foreign key",
      name: "BusinessFeatures_businessId_fkey",
      references: {
        table: "Subscriptions", // Name of the table it references
        field: "id", // Column in the referenced table
      },
      onDelete: "CASCADE", // Action on delete
      onUpdate: "CASCADE", // Action on update
    });

    // Rename the table back from "SubscriptionFeatures" to "BusinessFeatures"
    await queryInterface.renameTable(
      "SubscriptionFeatures",
      "BusinessFeatures"
    );
  },
};
