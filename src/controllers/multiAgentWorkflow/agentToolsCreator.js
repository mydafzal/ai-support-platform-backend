const { createRetrieverTool } = require("langchain/tools/retriever");
const { getVectoreStore } = require("../../integrations/chromaDB");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  checkSlotAvailability,
  getNextThreeSlots,
  getSlotsForNextDate,
  scheduleMeeting,
} = require("./meetingScheduler");

const jwt = require("jsonwebtoken");

const { FormLink } = require("../../../models");

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const twilio = require("twilio");
const {
  getCallData,
  updateCallConversation,
} = require("../../integrations/redis");
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

const monthsEnum = [
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
];
const datesEnum = Array.from({ length: 31 }, (_, index) => `${index + 1}`);
const hoursEnum = Array.from({ length: 23 }, (_, index) => `${index}`);

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
        .enum(monthsEnum)
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(datesEnum)
        .describe(
          "The specific date of the given month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(hoursEnum)
        .describe(
          "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled."
        ),
      customerEmail: z
        .string()
        .email()
        .describe(
          "Customer's email for sending email notification after scheduling the meeting."
        ),
      meetingDescription: z
        .string()
        .describe(
          "Anyone information extracted from the conversation that could help us know the purpose for scheduling this meeting."
        ),
    }),
    func: async ({ month, date, hour, customerEmail, meetingDescription }) => {
      console.log("schedule meeting called");
      console.log("meetingDescription - ", meetingDescription);

      return await scheduleMeeting(
        month,
        parseInt(date),
        parseInt(hour),
        meetingDescription,
        customerEmail,
        businessId
      );
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
        .enum(monthsEnum)
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(datesEnum)
        .describe(
          "The date of the month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(hoursEnum)
        .describe(
          "The specific hour between 0 to 23 at which the user would like to get his/her meeting scheduled."
        ),
    }),
    func: async ({ month, date, hour }) => {
      console.log("check-slot-availability called");

      const response = await checkSlotAvailability(
        month,
        parseInt(date),
        parseInt(hour),
        businessId
      );

      console.log("checkSlotAvailability - response", response);

      return response;
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
        .enum(monthsEnum)
        .describe(
          "The month in which the user would like to get his/her meeting scheduled."
        ),
      date: z
        .enum(datesEnum)
        .describe(
          "The date of the month on which the user would like to get his/her meeting scheduled."
        ),
      hour: z
        .enum(hoursEnum)
        .describe(
          "The specific hour you communicated to the user as the next available time slot."
        ),
    }),
    func: async ({ month, date, hour }) => {
      console.log("get-next-three-slots called");
      console.log("month - ", month);
      console.log("date - ", date);
      console.log("hour - ", hour);

      return await getNextThreeSlots(
        month,
        parseInt(date),
        parseInt(hour),
        businessId
      );
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
        .enum(monthsEnum)
        .describe(
          "The month in which the user would like to get his/her meeting scheduled. If you incremented the date parameter and that date exceeds the month given by the user, then you should also move the month to next one."
        ),
      date: z
        .enum(datesEnum)
        .describe(
          "The date next to the one that you previously provided for checking available time slots."
        ),
    }),
    func: async ({ month, date }) => {
      console.log("get-slots-for-next-date called");

      return await getSlotsForNextDate(month, parseInt(date), businessId);
    },
  });
}

function createSmsSenderTool(businessId) {
  return new DynamicStructuredTool({
    name: "send-sms",
    description:
      "Send an SMS containing the link to a form to collect the customer's details.",
    schema: z.object({
      phoneNumber: z
        .string()
        .describe("Customer's phone number for sending the SMS."),
    }),
    func: async ({ phoneNumber }) => {
      console.log("sms sender tool - called");

      const token = jwt.sign(
        { phoneNumber, timestamp: `${new Date()}` },
        process.env.JWT_SECRET
      );

      const messageBody = `We can't schedule your meeting at this time. Please visit the following link and provide some details. Then try again and we will get your meeting scheduled.
      
      ${process.env.CLIENT_BASE_URL}/form?token=${token}
      `;

      const message = await client.messages.create({
        body: messageBody,
        messagingServiceSid: MESSAGING_SERVICE_SID,
        to: phoneNumber,
      });

      await FormLink.create({
        phone: phoneNumber,
        token,
        businessId,
      });

      console.log("message.sid=====", message.sid);

      return "SMS has been sent to the customer.";
    },
  });
}

async function createGroupSaverTool() {
  return new DynamicStructuredTool({
    name: "group-saver",
    description: "Save the group to which the customer's calls belongs.",
    schema: z.object({
      callId: z.string().describe("The id of the current call."),
      groupName: z
        .string()
        .describe(
          "Name of the group to which the customer's call shall be connected. If no groups are available, don't provide the group name."
        )
        .optional(),
    }),
    func: async ({ callId, groupName }) => {
      console.log("group-saver tool called - ", groupName, callId);

      const callData = await getCallData(callId);
      callData.shouldRedirect = true;
      callData.groupToRedirect = groupName;

      await updateCallConversation(callId, callData);

      return "";
    },
  });
}

async function createUpdateCallDataTool() {
  return new DynamicStructuredTool({
    name: "update-call-data",
    description:
      "Update the data of the call to store information about whether the current call should be redirected to someone.",
    schema: z.object({
      callId: z.string().describe("The id of the current call."),
    }),
    func: async ({ callId }) => {
      console.log("update-call-data tool called - ", callId);

      const callData = await getCallData(callId);
      callData.shouldRedirect = true;
      await updateCallConversation(callId, callData);

      return "";
    },
  });
}

module.exports = {
  createSlotAvailaibilityCheckerTool,
  createNextSlotsGetterTool,
  createNextDateSlotsGetterTool,
  createMeetingSchedulerTool,
  createInformationRetrieverTool,
  createSmsSenderTool,
  createGroupSaverTool,
  createUpdateCallDataTool,
};
