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
        authUrl:
          "https://app.hubspot.com/oauth/authorize?client_id=c168eab0-d901-49a0-9137-e6cd0212e043&redirect_uri=https://customer-bot-git-staging-cheetah-agency.vercel.app/connect-integration&scope=crm.lists.read%20crm.objects.contacts.read%20crm.objects.contacts.write%20crm.objects.companies.write%20crm.lists.write%20crm.objects.companies.read",
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
        authUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events&response_type=code&client_id=466285189832-2hh7mgkft8n2pgc9u5v52r43grfcc1ip.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fcustomer-bot-git-staging-cheetah-agency.vercel.app%2Fconnect-integration",
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
        authUrl:
          "https://calendly.com/oauth/authorize?client_id=Gnz8k2nodDXDvPh1TgktTPeXHrGDLZcC1URnTbmkZs0&response_type=code&redirect_uri=https://customer-bot-git-staging-cheetah-agency.vercel.app/connect-integration",
      },
    ]);
  },

  async down(queryInterface, Sequelize) {},
};
