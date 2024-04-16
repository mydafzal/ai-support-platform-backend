const { createRetrieverTool } = require("langchain/tools/retriever");
const { getVectoreStore } = require("../../integrations/chromaDB");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const { BusinessIntegration } = require("../../../models");

const { Op } = require("sequelize");
const { z } = require("zod");
const { sendSMS } = require("../call.controller");

async function createInformationRetrieverTool(collectionName) {
  const vectorStore = await getVectoreStore(collectionName);
  const retriever = vectorStore.asRetriever();

  return createRetrieverTool(retriever, {
    name: "search-business-information",
    description:
      "Search for any information about the business. For any questions about the business, you must use this tool!",
  });
}

function createMeetingSchedulerTool(businessId) {
  return new DynamicStructuredTool({
    name: "meeting-scheduler",
    description:
      "Schedule the user's meeting based on the time slot accepted by the user. Provide month, date and hour all three to schedule the meeting.",
    schema: z.object({
      month: z
        .enum([
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ])
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(Array.from({ length: 31 }, (_, index) => index + 1))
        .describe(
          "The specific date of the given month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(Array.from({ length: 23 }, (_, index) => index))
        .describe(
          "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled."
        ),
    }),
    func: ({ month, date, hour }) => {
      console.log("schedule meeting called");
      return "";
    },
  });
}

function createSlotAvailaibilityCheckerTool(businessId) {
  return new DynamicStructuredTool({
    name: "check-slot-availability",
    description:
      "Based on the month, date and hour provided by the user, check if the slot is available.",
    schema: z.object({
      month: z
        .enum([
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ])
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(Array.from({ length: 31 }, (_, index) => index + 1))
        .describe(
          "The date of the month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(Array.from({ length: 23 }, (_, index) => index))
        .describe(
          "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled."
        ),
    }),
    func: ({ month, date, hour }) => {
      console.log("check-slot-availability called");
      console.log("month - ", month);
      console.log("date - ", date);
      console.log("hour - ", hour);

      return "";
    },
  });
}

function createNextSlotsGetterTool(businessId) {
  return new DynamicStructuredTool({
    name: "get-next-three-slots",
    description:
      "The user declined your request to schedule meeting on the slot that you communicated as the next available slot, that is next to the one the user originally requested. The slot that you communicated was available but the user refused to schedule meeting on that slot.",
    schema: z.object({
      month: z
        .enum([
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ])
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(Array.from({ length: 31 }, (_, index) => index + 1))
        .describe(
          "The date of the month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(Array.from({ length: 23 }, (_, index) => index))
        .describe(
          "The specific hour you communicated to the user as the next available time slot."
        ),
    }),
    func: ({ month, date, hour }) => {
      console.log("get-next-three-slots called");
      console.log("month - ", month);
      console.log("date - ", date);
      console.log("hour - ", hour);

      return "";
    },
  });
}

function createNextDateSlotsGetterTool(businessId) {
  return new DynamicStructuredTool({
    name: "get-slots-for-next-date",
    description:
      "No time slots are left on the date you currently provided so now get available slots for the next date.",
    schema: z.object({
      month: z
        .enum([
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ])
        .describe(
          "The month in which the user would like to get his/her meeting scheduled. If you incremented the date parameter and that date exceeds the month given by the user, then you should also move the month to next one."
        ),
      date: z
        .enum(Array.from({ length: 31 }, (_, index) => index + 1))
        .describe(
          "The date next to the one that you previously provided for checking available time slots."
        ),
    }),
    func: ({ month, date }) => {
      console.log("get-slots-for-next-date called");
      console.log("month - ", month);
      console.log("date - ", date);

      return "";
    },
  });
}

function canScheduleMeeting(businessId) {
  return new DynamicStructuredTool({
    name: "can-schedule-meeting",
    description:
      "No time slots are left on the date you currently provided so now get available slots for the next date.",
    schema: z.object({}),
    func: async () => {
      console.log("can-schedule-meeting - called");

      const count = await BusinessIntegration.count({
        where: {
          businessId,
          integrationId: {
            [Op.in]: [2, 3],
          },
        },
      });

      if (count !== 2) {
        return false;
      }

      return true;
    },
  });
}

function createSmsSenderTool() {
  return new DynamicStructuredTool({
    name: "send-sms",
    description:
      "Send an SMS containing the link to a form to collect the customer's details.",
    schema: z.object({
      phoneNumber: z
        .string()
        .describe("Customer's phone number for sending the SMS."),
    }),
    func: async () => {
      console.log("sms sender tool - called");

      const messageBody = `We can't schedule your meeting at this time. Please visit the following link and provide some basic details. Then try again and we will get your meeting scheduled.
      
      http://localhost:3000
      `;

      await sendSMS(phoneNumber, messageBody);
      return "SMS has been to the customer.";
    },
  });
}

module.exports = {
  createSlotAvailaibilityCheckerTool,
  createNextSlotsGetterTool,
  createNextDateSlotsGetterTool,
  createMeetingSchedulerTool,
  createInformationRetrieverTool,
  canScheduleMeeting,
  createSmsSenderTool,
};
