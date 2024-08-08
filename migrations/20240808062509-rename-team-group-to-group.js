"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable("TeamGroups", "Groups");
  },

  async down(queryInterface) {
    await queryInterface.renameTable("Groups", "TeamGroups");
  },
};
