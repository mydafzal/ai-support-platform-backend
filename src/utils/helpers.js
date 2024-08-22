const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");

const { BusinessIntegration } = require("../../models");

const { RedisChatMessageHistory } = require("langchain/stores/message/redis");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");

const pdf = require("pdf-thumbnail");
const fs = require("fs/promises");

const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  CALENDLY_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  HUBPOST_INTEGRATION_ID,
} = require("./constants");

function generateFilename(fileExtension) {
  const uniqueId = uuidv4();

  const timestamp = getUnixTime(new Date());

  const uniqueFilename = `${timestamp}_${uniqueId}.${fileExtension}`;
  return uniqueFilename;
}

class ExtendedRedisChatMemory extends RedisChatMessageHistory {
  async addMessage(message) {
    const messages = await this.getMessages();

    message.additional_kwargs = {
      timestamp: new Date().getTime(),
      id: messages.length + 1,
    };

    await super.addMessage(message);
  }
}

async function generateChatTitle(userQuery) {
  const chatModel = new ChatOpenAI({});

  const prompt = PromptTemplate.fromTemplate(
    `Devise a chat title that incorporates the user's question about a specific topic. Title should be atmost 5 words and ideally 3 words. Make sure you don't include the word 'chat' in the title. 
    
    User's question: ${userQuery}
    `
  );

  const outputParser = new StringOutputParser();

  const llmChain = prompt.pipe(chatModel).pipe(outputParser);

  const chatTitle = await llmChain.invoke({
    input: "what is LangSmith?",
  });

  console.log("chatTitle", chatTitle);

  return chatTitle;
}

async function generatePdfThumbnail(sourceFilePath, thumbnailPath) {
  const pdfBuffer = await fs.readFile(sourceFilePath);

  pdf(pdfBuffer)
    .then(async (data) => {
      console.log("PDF preview generated.");
      await fs.writeFile(thumbnailPath, data);
    })
    .catch((err) => console.log("Error generating pdf preview", err));
}

function generateEmailVerificationToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

function generateJWT(payload) {
  return jwt.sign({ ...payload }, process.env.JWT_SECRET);
}

function generateEmailLink(path, queryParams) {
  return `${process.env.CLIENT_BASE_URL}/${path}?${queryParams}`;
}

async function getConnectedIntegrationsCount(businessId) {
  const count = await BusinessIntegration.count({
    where: {
      businessId,
      integrationId: {
        [Op.in]: [
          CALENDLY_INTEGRATION_ID,
          GOOGLE_CALENDAR_INTEGRATION_ID,
          HUBPOST_INTEGRATION_ID,
        ],
      },
    },
  });

  return count;
}

function isValidInteger(str) {
  const integerRegex = /^-?\d+$/;
  return integerRegex.test(str);
}

function calculateYearlyPrice(baseMonthlyPrice, yearlyDiscountPercentage) {
  const baseMonthly = parseFloat(baseMonthlyPrice);
  const discountPercentage = parseFloat(yearlyDiscountPercentage);

  const baseYearlyPrice = baseMonthly * 12;
  const discountAmount = (discountPercentage / 100) * baseYearlyPrice;

  const finalYearlyPrice = baseYearlyPrice - discountAmount;
  return finalYearlyPrice.toFixed(2);
}

function capitalizeFirstLetterOfEachWord(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getNextMonthlyResetDate(startDate) {
  const start = new Date(startDate * 1000);
  const now = new Date();

  // Calculate next reset date
  let nextReset = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    start.getDate()
  );

  // Adjust for month overflow (e.g., starting on Jan 31 -> Feb 28/29 or Mar 1)
  if (nextReset.getDate() < start.getDate()) {
    nextReset.setDate(0); // Set to the last day of the previous month
  }

  const formattedDate = nextReset.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return formattedDate;
}

module.exports = {
  generateFilename,
  ExtendedRedisChatMemory,
  generateChatTitle,
  generatePdfThumbnail,
  generateEmailVerificationToken,
  generateJWT,
  generateEmailLink,
  getConnectedIntegrationsCount,
  isValidInteger,
  calculateYearlyPrice,
  capitalizeFirstLetterOfEachWord,
  getNextMonthlyResetDate,
};
