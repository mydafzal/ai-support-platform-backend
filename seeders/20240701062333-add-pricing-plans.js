"use strict";

const {
  FREE_PLAN_ID,
  ENTERPRISE_PLAN_ID,
  PRO_PLAN_ID,
} = require("../src/utils/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    return queryInterface.bulkInsert("PricingPlans", [
      {
        id: FREE_PLAN_ID,
        name: "FREE",
        tagline: "Get Started with Essential Features at No Cost",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PRO_PLAN_ID,
        name: "PRO",
        tagline: "Unlock Advanced Capabilities for Growing Teams",
        monthlyBasePrice: 50,
        yearlyDiscountPercentage: 10,
        basePlanId: FREE_PLAN_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: ENTERPRISE_PLAN_ID,
        name: "ENTERPRISE",
        tagline: "Scale Your Business with Comprehensive Solutions",
        monthlyBasePrice: 100,
        yearlyDiscountPercentage: 10,
        basePlanId: PRO_PLAN_ID,
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
