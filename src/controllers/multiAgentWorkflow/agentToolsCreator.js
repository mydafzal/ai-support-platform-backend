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

const {
  FormLink,
  User,
  Chat,
  ChatUserAssignment,
  BusinessIntegration,
  Integration,
  Business,
  GroupMembership,
  BusinessMembership,
} = require("../../../models");

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const twilio = require("twilio");
const {
  getCallData,
  updateCallConversation,
  redisClient,
} = require("../../integrations/redis");
const {
  ACCEPTING_CHATS,
  HUBPOST_INTEGRATION_ID,
} = require("../../utils/constants");
const { Op } = require("sequelize");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

const { v4: uuidv4 } = require("uuid");
const { createContact } = require("../../integrations/hubspotCRM");
const { sendEmail } = require("../../integrations/nodemailer");

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

function createInformationRetrieverTool(
  collectionName,
  shouldGenerateShortResponses = false
) {
  return new DynamicStructuredTool({
    name: "search-business-information",
    description:
      "Search for any information about the business. For any questions about the business, you must use this tool!",
    schema: z.object({
      userQuery: z
        .string()
        .describe(
          "User's original query based on the context of the overall conversation."
        ),
    }),
    func: async ({ userQuery }) => {
      let finalDocs = [];
      const store = await getVectoreStore(collectionName);
      const generatedQueries = await generateQueries(userQuery);
      const altQueryDocs = {};

      const alternateQueriesToGenerate = shouldGenerateShortResponses ? 2 : 4;

      await Promise.all(
        generatedQueries.map(async (generatedQuery) => {
          const docsFromAltQuery = await store.similaritySearch(
            generatedQuery,
            alternateQueriesToGenerate
          );

          docsFromAltQuery.forEach((doc) => {
            doc.id = uuidv4();
          });

          finalDocs = finalDocs.concat(docsFromAltQuery);
          altQueryDocs[generatedQuery] = docsFromAltQuery;
        })
      );

      const rankedResults = reciprocalRankFusion(altQueryDocs);

      const finalDocArray = [];

      for (const key in rankedResults) {
        const matchingDoc = finalDocs.find((doc) => doc.id === key);

        if (matchingDoc) {
          finalDocArray.push(matchingDoc);
        }
      }

      let outputContext = "";
      for (const doc of finalDocArray) {
        outputContext += doc.pageContent;
      }

      return outputContext;
    },
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

      const business = await Business.findOne({
        where: {
          id: businessId,
        },
        raw: true,
      });

      const token = jwt.sign(
        {
          phoneNumber,
          timestamp: `${new Date()}`,
          leadMode: business.leadMode,
        },
        process.env.JWT_SECRET
      );

      const messageBody = `We can't schedule your meeting at this time. Please visit the following link and provide some details. Then try again and we will get your meeting scheduled.
      
      ${process.env.CLIENT_BASE_URL}/form?token=${token}
      `;

      console.log("messageBody - ", messageBody);

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

function createGroupSaverTool() {
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

function createUpdateCallDataTool() {
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

function createAgentAvailabilityCheckerTool() {
  return new DynamicStructuredTool({
    name: "check-agent-availability",
    description: "Check if an agent is available to take over the chat.",
    schema: z.object({
      chatId: z.number().describe("The id of the current chat."),
    }),
    func: async ({ chatId }) => {
      const chatMessages = await redisClient.lRange(`chat-${chatId}`, 0, -1);

      let groupId;

      for (let i = chatMessages.length - 1; i >= 0; i--) {
        const item = JSON.parse(chatMessages[i]);

        if (item["type"] === "pre-chat-form") {
          groupId = item.content.groupId;
          break;
        }
      }

      let chat = await Chat.findOne({
        where: {
          id: chatId,
        },
        raw: true,
      });

      let chats = await Chat.findAll({
        where: {
          connectedUserId: {
            [Op.not]: null,
          },
          businessId: chat.businessId,
        },
        raw: true,
      });

      const connectedUserIds = chats.map((item) => item.connectedUserId);

      const availableMembers = await BusinessMembership.findAll({
        where: {
          businessId: chat.businessId,
          userId: {
            [Op.notIn]: connectedUserIds,
          },
        },
        raw: true,
      });

      let availableMemberIds = availableMembers.map((item) => item.userId);

      if (groupId) {
        const availableMembersofGroup = await GroupMembership.findAll({
          where: {
            groupId,
            userId: {
              [Op.in]: availableMemberIds,
            },
          },
          raw: true,
        });

        availableMemberIds = availableMembersofGroup.map((item) => item.userId);
      }

      let whereCondition = {
        id: {
          [Op.in]: availableMemberIds,
        },
        status: ACCEPTING_CHATS,
      };

      let user = await User.findOne({
        where: whereCondition,
      });

      if (user) {
        await Chat.update(
          {
            connectedUserId: user.id,
          },
          {
            where: {
              id: chatId,
            },
          }
        );

        const count = await ChatUserAssignment.count({
          where: {
            chatId,
            userId: user.id,
          },
        });

        if (count <= 0) {
          await ChatUserAssignment.create({
            chatId,
            userId: user.id,
          });
        } else {
          await ChatUserAssignment.update(
            {
              viewed: false,
            },
            {
              where: {
                chatId,
                userId: user.id,
              },
            }
          );
        }

        return "An agent is available to take over the chat.";
      }

      return "No agent is currently available.";
    },
  });
}

async function generateQueries(originalQuery) {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo-1106" });
  const outputParser = new StringOutputParser();

  const prompt = PromptTemplate.fromTemplate(
    `You are a helpful assistant that generates alternative queries that could be asked to a large language model related to the users original query: {originalQuery}. OUTPUT A COMMA SEPARATED LIST (CSV) of 4 alternative queries. Don't prefix the queries with numbering. We want queries without any numbering or ordering. Make sure each query starts on a new line. Do not include the original query in the array`
  );

  const chain = prompt.pipe(model).pipe(outputParser);

  const response = await chain.invoke({
    originalQuery,
  });

  const generatedQueries = response.trim().split("\n");
  return generatedQueries;
}

function reciprocalRankFusion(altQueryDocs, k = 60) {
  const fusedScores = {};

  for (const query in altQueryDocs) {
    if (altQueryDocs.hasOwnProperty(query)) {
      const docObj = altQueryDocs[query];

      for (let rank = 0; rank < Object.keys(docObj).length; rank++) {
        const sortedDocs = Object.entries(docObj).sort((a, b) => b[1] - a[1]);

        const [score, doc] = sortedDocs[rank];

        const docID = doc.id;

        const fusedDoc = fusedScores[docID];
        if (!fusedDoc) {
          fusedScores[docID] = 0;
        }

        const previousScore = fusedScores[docID];

        fusedScores[docID] += 1 / (rank + k);
      }
    }
  }

  return fusedScores;
}

function createCustomerSaverTool(businessId) {
  return new DynamicStructuredTool({
    name: "save-customer-information",
    description: "save the customer's information to capture a potential lead.",
    schema: z.object({
      name: z.string().describe("customer's full name"),
      email: z.string().email().describe("customer's email"),
      phone: z.string().describe("customer's phone number"),
    }),
    func: async (customerDetails) => {
      try {
        const hubspotIntegration = await BusinessIntegration.findOne({
          where: {
            businessId,
            integrationId: HUBPOST_INTEGRATION_ID,
          },
          include: [
            { model: Integration, as: "integration" },
            {
              model: Business,
              as: "business",
              include: [
                {
                  model: User,
                  as: "adminUser",
                  attributes: ["name", "email"],
                },
              ],
            },
          ],
          raw: true,
          nest: true,
        });

        const { adminUser } = hubspotIntegration.business;

        await createContact(
          hubspotIntegration.accessToken,
          hubspotIntegration.refreshToken,
          hubspotIntegration.expirationTime,
          businessId,
          { ...customerDetails }
        );

        console.log("customer Details - ", customerDetails);

        const emailTemplate = `
          <html>
            <body>
                <p>Dear ${adminUser.name},</p>
                <p>A new lead has been successfully captured and added to your CRM.</p>
                <p><strong>CRM:</strong> ${hubspotIntegration.integration.name}</p>
                <p><strong>Lead Information:</strong></p>
                <ul>
                    <li><strong>Name:</strong> ${customerDetails.name}</li>
                    <li><strong>Phone Number:</strong> ${customerDetails.phone}</li>
                    <li><strong>Email Address:</strong> ${customerDetails.email}</li>
                </ul>
                <p>Thank you for using CustomerBot. If you have any questions or need further assistance, please contact our support team.</p>
                <p>Best regards,<br>The CustomerBot Team</p>
            </body>
          </html>`;

        await sendEmail(adminUser.email, emailTemplate);

        return "Customer's information has been saved";
      } catch (error) {
        console.log("save-customer-information tool error - ", error);
      }
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
  createAgentAvailabilityCheckerTool,
  createCustomerSaverTool,
};
