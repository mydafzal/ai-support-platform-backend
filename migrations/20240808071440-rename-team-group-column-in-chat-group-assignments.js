"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameColumn(
      "ChatGroupAssignments",
      "teamGroupId",
      "groupId"
    );

    await queryInterface.removeConstraint(
      "ChatGroupAssignments",
      "ChatGroupAssignments_teamGroupId_fkey"
    );

    await queryInterface.addConstraint("ChatGroupAssignments", {
      fields: ["groupId"],
      type: "foreign key",
      name: "ChatGroupAssignments_groupId_fkey",
      references: {
        table: "Groups",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface) {
    await queryInterface.renameColumn(
      "ChatGroupAssignments",
      "groupId",
      "teamGroupId"
    );

    await queryInterface.removeConstraint(
      "ChatGroupAssignments",
      "ChatGroupAssignments_groupId_fkey"
    );

    await queryInterface.addConstraint("ChatGroupAssignments", {
      fields: ["teamGroupId"],
      type: "foreign key",
      name: "ChatGroupAssignments_teamGroupId_fkey",
      references: {
        table: "Groups",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },
};
