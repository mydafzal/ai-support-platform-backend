"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("BusinessFeatures", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("BusinessFeatures", "featureId", {
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
    await queryInterface.removeColumn("BusinessFeatures", "businessId");
    await queryInterface.removeColumn("BusinessFeatures", "featureId");
  },
};
