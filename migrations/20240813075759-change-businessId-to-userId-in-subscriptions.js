"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the constraint exists before removing it
    const constraints = await queryInterface.showConstraint("Subscriptions");
    const columns = await queryInterface.describeTable("Subscriptions");

    const userIdConstraint = constraints.find(
      (constraint) => constraint.constraintName === "Subscriptions_userId_fkey"
    );

    const businessIdConstraint = constraints.find(
      (constraint) =>
        constraint.constraintName === "Subscriptions_businessId_fkey"
    );

    if (userIdConstraint) {
      // Remove the existing foreign key constraint for businessId
      await queryInterface.removeConstraint(
        "Subscriptions",
        "Subscriptions_userId_fkey"
      );
    }

    if (businessIdConstraint) {
      // Remove the existing foreign key constraint for businessId
      await queryInterface.removeConstraint(
        "Subscriptions",
        "Subscriptions_businessId_fkey"
      );
    }

    if (columns.businessId) {
      await queryInterface.removeColumn("Subscriptions", "businessId");
    }

    if (!columns.userId) {
      // Add the userId column
      await queryInterface.addColumn("Subscriptions", "userId", {
        type: Sequelize.INTEGER,
        references: {
          model: "Users", // Name of the target table
          key: "id", // Key in the target table
        },
        onUpdate: "CASCADE", // Handle updates in the referenced table
        onDelete: "SET NULL", // Handle deletions in the referenced table
      });
    }

    if (!userIdConstraint) {
      // Create a new foreign key constraint for userId
      await queryInterface.addConstraint("Subscriptions", {
        fields: ["userId"],
        type: "foreign key",
        name: "Subscriptions_userId_fkey",
        references: {
          table: "Users",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the foreign key constraint for userId
    await queryInterface.removeConstraint(
      "Subscriptions",
      "Subscriptions_userId_fkey"
    );

    // Remove the userId column
    await queryInterface.removeColumn("Subscriptions", "userId");

    // Add back the businessId column
    await queryInterface.addColumn("Subscriptions", "businessId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Businesses", // Name of the target table
        key: "id", // Key in the target table
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Create the foreign key constraint for businessId
    await queryInterface.addConstraint("Subscriptions", {
      fields: ["businessId"],
      type: "foreign key",
      name: "Subscriptions_businessId_fkey",
      references: {
        table: "Businesses",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
