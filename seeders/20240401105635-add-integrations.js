"use strict";

const {
  HUBPOST_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  CALENDLY_INTEGRATION_ID,
} = require("../src/utils/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    return queryInterface.bulkInsert("Integrations", [
      {
        id: HUBPOST_INTEGRATION_ID,
        name: "HubSpot",
        tagline: "Customer Relation Management",
        imageUrl:
          "https://res.cloudinary.com/dsfbsdf0x/image/upload/v1711968888/bimx4fhkumq7on3rs8p1.png",
        createdAt: new Date(),
        updatedAt: new Date(),
        recommended: true,
        authUrl: process.env.HUBSPOT_AUTH_URL,
      },
      {
        id: GOOGLE_CALENDAR_INTEGRATION_ID,
        name: "Google Calendar",
        tagline: "Your All Schedules",
        imageUrl:
          "https://res.cloudinary.com/dsfbsdf0x/image/upload/v1711968888/bdp2si0molfd6bzndtg8.png",
        createdAt: new Date(),
        updatedAt: new Date(),
        recommended: true,
        authUrl: process.env.GOOGLE_AUTH_URL,
      },
      {
        id: CALENDLY_INTEGRATION_ID,
        name: "Calendly",
        tagline: "Your All Schedules",
        imageUrl:
          "https://res.cloudinary.com/dsfbsdf0x/image/upload/v1711968888/xufffyxgm0wjgokwndef.png",
        createdAt: new Date(),
        updatedAt: new Date(),
        recommended: true,
        authUrl: process.env.CALENDLY_AUTH_URL,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {},
};
