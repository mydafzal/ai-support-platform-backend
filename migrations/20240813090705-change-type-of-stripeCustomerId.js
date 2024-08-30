"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the existing foreign key constraint for stripeCustomerId
    await queryInterface.removeConstraint(
      "Users",
      "Users_stripeCustomerId_fkey"
    );

    // Remove the existing stripeCustomerId column
    await queryInterface.removeColumn("Users", "stripeCustomerId");

    // Add the new stripeCustomerId column as a string
    await queryInterface.addColumn("Users", "stripeCustomerId", {
      type: Sequelize.STRING,
      allowNull: true, // or false depending on whether you want this field to be required
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the new stripeCustomerId column
    await queryInterface.removeColumn("Users", "stripeCustomerId");

    // Add back the original stripeCustomerId column with foreign key constraint
    await queryInterface.addColumn("Users", "stripeCustomerId", {
      type: Sequelize.INTEGER,
      allowNull: true, // or false depending on your requirements
      references: {
        model: "Features", // Name of the target table
        key: "id", // Key in the target table
      },
      onUpdate: "CASCADE", // Handle updates in the referenced table
      onDelete: "SET NULL", // Handle deletions in the referenced table
    });

    // Recreate the foreign key constraint for the original stripeCustomerId
    await queryInterface.addConstraint("Users", {
      fields: ["stripeCustomerId"],
      type: "foreign key",
      name: "Users_stripeCustomerId_fkey",
      references: {
        table: "Features",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
