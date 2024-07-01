"use strict";

const {
  FREE_PHONE_FEATURE_ID,
  FREE_PLAN_ID,
  CALL_MINUTES_FEATURE_ID,
  MEETING_FEATURE_ID,
  TEAM_MEMBERS_FEATURE_ID,
  CHATS_FEATURE_ID,
  PRO_PLAN_ID,
  POWERED_BY_FEATURE_ID,
  ENTERPRISE_PLAN_ID,
  COMPANIES_FEATURE_ID,
} = require("../src/utils/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    return queryInterface.bulkInsert("PlanFeatures", [
      // FREE Plan Features
      {
        planId: FREE_PLAN_ID,
        featureId: FREE_PHONE_FEATURE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: FREE_PLAN_ID,
        featureId: CALL_MINUTES_FEATURE_ID,
        baseQuantity: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: FREE_PLAN_ID,
        featureId: MEETING_FEATURE_ID,
        baseQuantity: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: FREE_PLAN_ID,
        featureId: TEAM_MEMBERS_FEATURE_ID,
        baseQuantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: FREE_PLAN_ID,
        featureId: CHATS_FEATURE_ID,
        baseQuantity: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // PRO Plan Features:
      {
        planId: PRO_PLAN_ID,
        featureId: CALL_MINUTES_FEATURE_ID,
        baseQuantity: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: PRO_PLAN_ID,
        featureId: MEETING_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: PRO_PLAN_ID,
        featureId: TEAM_MEMBERS_FEATURE_ID,
        baseQuantity: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: PRO_PLAN_ID,
        featureId: CHATS_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: PRO_PLAN_ID,
        featureId: POWERED_BY_FEATURE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // ENTERPRISE Plan Features:
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: COMPANIES_FEATURE_ID,
        baseQuantity: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
