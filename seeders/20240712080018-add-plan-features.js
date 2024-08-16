"use strict";

const {
  PRO_PLAN_ID,
  FREE_PLAN_ID,
  CHATS_FEATURE_ID,
  FREE_PHONE_FEATURE_ID,
  CALL_MINUTES_FEATURE_ID,
  MEETING_FEATURE_ID,
  TEAM_MEMBERS_FEATURE_ID,
  POWERED_BY_FEATURE_ID,
  COMPANIES_FEATURE_ID,
  ENTERPRISE_PLAN_ID,
} = require("../src/utils/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const currentTimestamp = new Date();

    return queryInterface.bulkInsert("PlanFeatures", [
      // FREE Plan Features
      {
        planId: FREE_PLAN_ID,
        featureId: FREE_PHONE_FEATURE_ID,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: FREE_PLAN_ID,
        featureId: CALL_MINUTES_FEATURE_ID,
        baseQuantity: 50,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: FREE_PLAN_ID,
        featureId: MEETING_FEATURE_ID,
        baseQuantity: 2,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: FREE_PLAN_ID,
        featureId: TEAM_MEMBERS_FEATURE_ID,
        baseQuantity: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: FREE_PLAN_ID,
        featureId: CHATS_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: FREE_PLAN_ID,
        featureId: COMPANIES_FEATURE_ID,
        baseQuantity: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },

      // PRO Plan Features
      {
        planId: PRO_PLAN_ID,
        featureId: FREE_PHONE_FEATURE_ID,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: CALL_MINUTES_FEATURE_ID,
        baseQuantity: 1000,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: MEETING_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: TEAM_MEMBERS_FEATURE_ID,
        baseQuantity: 3,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: CHATS_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: POWERED_BY_FEATURE_ID,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: PRO_PLAN_ID,
        featureId: COMPANIES_FEATURE_ID,
        baseQuantity: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },

      // ENTERPRISE Plan Features
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: FREE_PHONE_FEATURE_ID,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: CALL_MINUTES_FEATURE_ID,
        baseQuantity: 1000,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: MEETING_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: TEAM_MEMBERS_FEATURE_ID,
        baseQuantity: 3,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: CHATS_FEATURE_ID,
        baseQuantity: "Unlimited",
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: POWERED_BY_FEATURE_ID,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
      {
        planId: ENTERPRISE_PLAN_ID,
        featureId: COMPANIES_FEATURE_ID,
        baseQuantity: 5,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {},
};
