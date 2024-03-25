const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const { RedisChatMessageHistory } = require("langchain/stores/message/redis");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");

const pdf = require("pdf-thumbnail");
const fs = require("fs/promises");

const jwt = require("jsonwebtoken");

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

function generateEmailLink(request, path, queryParams) {
  return `${request.protocol}://${request.get("host")}/${path}?${queryParams}`;
}

module.exports = {
  generateFilename,
  ExtendedRedisChatMemory,
  generateChatTitle,
  generatePdfThumbnail,
  generateEmailVerificationToken,
  generateJWT,
  generateEmailLink,
};
