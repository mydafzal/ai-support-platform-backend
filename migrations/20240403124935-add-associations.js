"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    await queryInterface.addColumn("Businesses", "adminUserId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Assistants", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Calls", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Calls", "callTagId", {
      type: Sequelize.INTEGER,
      references: {
        model: "CallTags",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("CallTags", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Documents", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Urls", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("BusinessIntegrations", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("BusinessIntegrations", "integrationId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Integrations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("TeamGroups", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("IntegrationWarnings", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("IntegrationWarnings", "integrationId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Integrations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("Users", "role", {
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

    await queryInterface.addColumn("Users", "teamGroupId", {
      type: Sequelize.INTEGER,
      references: {
        model: "TeamGroups",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Invitations", "teamGroupId", {
      type: Sequelize.INTEGER,
      references: {
        model: "TeamGroups",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Invitations", "businessId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Businesses",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
