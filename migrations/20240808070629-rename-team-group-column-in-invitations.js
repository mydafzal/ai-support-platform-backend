"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameColumn("Invitations", "teamGroupId", "groupId");

    await queryInterface.removeConstraint(
      "Invitations",
      "Invitations_teamGroupId_fkey"
    );

    await queryInterface.addConstraint("Invitations", {
      fields: ["groupId"],
      type: "foreign key",
      name: "Invitations_groupId_fkey",
      references: {
        table: "Groups",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface) {
    await queryInterface.renameColumn("Invitations", "groupId", "teamGroupId");

    await queryInterface.removeConstraint(
      "Invitations",
      "Invitations_groupId_fkey"
    );

    await queryInterface.addConstraint("Invitations", {
      fields: ["teamGroupId"],
      type: "foreign key",
      name: "Invitations_teamGroupId_fkey",
      references: {
        table: "TeamGroups",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },
};
