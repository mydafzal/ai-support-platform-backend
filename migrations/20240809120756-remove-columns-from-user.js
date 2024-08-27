"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("Users", "role");
    await queryInterface.removeColumn("Users", "businessId");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "role", {
      type: Sequelize.ENUM("Admin", "TeamMember"),
    });

    await queryInterface.addColumn("Users", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};
