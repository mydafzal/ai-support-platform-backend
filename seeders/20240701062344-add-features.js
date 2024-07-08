"use strict";

const {
  FREE_PHONE_FEATURE_ID,
  CALL_MINUTES_FEATURE_ID,
  MEETING_FEATURE_ID,
  TEAM_MEMBERS_FEATURE_ID,
  CHATS_FEATURE_ID,
  POWERED_BY_FEATURE_ID,
  COMPANIES_FEATURE_ID,
} = require("../src/utils/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    return queryInterface.bulkInsert("Features", [
      {
        id: FREE_PHONE_FEATURE_ID,
        nameSingular: "Free phone number",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: CALL_MINUTES_FEATURE_ID,
        nameSingular: "call minute/month",
        namePlural: "call minutes/month",
        unitPrice: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: MEETING_FEATURE_ID,
        nameSingular: "meeting/month",
        namePlural: "meetings/month",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: TEAM_MEMBERS_FEATURE_ID,
        nameSingular: "team member/month",
        namePlural: "team members/month",
        unitPrice: 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: CHATS_FEATURE_ID,
        nameSingular: "website chat/month",
        namePlural: "website chats/month",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: POWERED_BY_FEATURE_ID,
        nameSingular: "No Powered by CustomerBot logo in chat widget",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: COMPANIES_FEATURE_ID,
        nameSingular: "company/month",
        namePlural: "companies/month",
        unitPrice: 25,
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
