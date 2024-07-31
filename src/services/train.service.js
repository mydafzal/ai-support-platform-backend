const fs = require("fs");
const path = require("path");

const { Assistant, Business, Url, Document } = require("../../models");

const {
  scrapeAndPersistData,
  readFileAndPersistData,
} = require("../controllers/dataLoader.controller");

const { redisClient } = require("../integrations/redis");

const { getBrowser } = require("../integrations/urlScreenshot");

const { DOCUMENTS_BASE_PATH } = require("../utils/constants");

const SummarizationService = require("./summarization.service");

const {
  generateTrainingAgentResponse,
} = require("../controllers/trainingAgent.controller");

const {
  deleteChunksByDocument,
  deleteChunksByUrl,
} = require("../integrations/chromaDB");

async function trainWithUrls(data) {
  let { urls, businessId } = data;

  if (urls.length < 1) {
    throw { statusCode: 400, message: "Provide one or more urls." };
  }

  let assistant = await Assistant.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  if (!assistant) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  urls = urls.map((url) => ({
    link: url,
    businessId,
  }));

  urls = await Url.bulkCreate(urls);
  urls = urls.map((url) => url.toJSON());

  let promises = urls.map((url) =>
    scrapeAndPersistData(url.link, assistant.knowledgeBaseName, url.id)
  );

  await Promise.all(promises);

  const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);
  await fs.promises.mkdir(destinationPath, { recursive: true }); // create directory if doesn't exist already.

  await captureScreenshotOfWebpages(urls, destinationPath);

  await saveUploadsToTrainingChat("url", urls, businessId);

  return "Data loaded from provided urls.";
}

async function captureScreenshotOfWebpages(urls, destinationPath) {
  const browser = getBrowser();

  const promises = urls.map(async (url) => {
    try {
      const page = await browser.newPage();

      await page.goto(url.link);

      await page.screenshot({
        path: `${destinationPath}/url-${url.id}-preview.png`,
      });
    } catch (error) {
      console.log("error capturing screenshot - ", error);
    }
  });

  await Promise.all(promises);
}

async function trainWithDocuments(data) {
  let { businessId, files } = data;

  let assistant = await Assistant.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  if (!assistant) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  files = files.map((file) => ({
    name: file.originalname,
    size: file.size,
    type: file.mimetype,
    businessId,
  }));

  let documents = await Document.bulkCreate(files);
  documents = documents.map((doc) => doc.toJSON());

  const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);
  await fs.promises.mkdir(destinationPath, { recursive: true });

  let promises = documents.map(async (document) => {
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "documents",
      document.name
    );

    await readFileAndPersistData(
      filePath,
      assistant.knowledgeBaseName,
      document.id
    );

    await fs.promises.rename(filePath, `${destinationPath}/${document.name}`);
  });

  await Promise.all(promises);

  await saveUploadsToTrainingChat("document", documents, businessId);

  return "Data loaded from provided files.";
}

async function saveUploadsToTrainingChat(uploadType, data, businessId) {
  const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);

  const promises = data.map(async (item) => {
    let messageContent;

    if (uploadType === "url") {
      const summary = await SummarizationService.summarizeWebpage(item.link);

      messageContent = `User uploaded a url. The url link is ${item.link} and the url id is ${item.id}. \nHere is the summarized information about the uploaded url:
                
    ${summary}`;
    } else {
      const documentPath = `${destinationPath}/${item.name}`;
      const documentExtension = path.extname(documentPath);

      const summary = await SummarizationService.summarizeDocument(
        documentPath,
        documentExtension
      );

      messageContent = `User uploaded a document. The document name is ${item.name} and the document id is ${item.id}. \nHere is the summarized information about the uploaded document:
                
    ${summary}`;
    }

    const message = {
      type: "human",
      data: {
        content: messageContent,
        additional_kwargs: {
          timestamp: Date.now(),
          isUrl: uploadType === "url",
          isDocument: uploadType === "document",
        },
        response_metadata: {},
      },
    };

    return redisClient.lPush(
      `train-chat-${businessId}`,
      JSON.stringify(message)
    );
  });

  await Promise.all(promises);
}

async function trainWithChat(data) {
  const { message, businessId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
    include: [{ model: Assistant, as: "assistant" }],
    raw: true,
    nest: true,
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  const aiResponse = await generateTrainingAgentResponse(
    message,
    business.assistant.knowledgeBaseName,
    business.assistant.name,
    businessId
  );

  return {
    type: "ai",
    timestamp: new Date().getTime(),
    content: aiResponse,
  };
}

async function deleteDocument(data) {
  const { documentId } = data;

  let document = await Document.findByPk(documentId, { raw: true });

  if (!document) return;

  await Document.destroy({
    where: {
      id: documentId,
    },
  });

  const filePath = path.join(
    DOCUMENTS_BASE_PATH,
    `${document.businessId}`,
    document.name
  );

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }

  let assistant = await Assistant.findOne({
    where: {
      businessId: document.businessId,
    },
    raw: true,
  });

  await deleteChunksByDocument(assistant.knowledgeBaseName, documentId);
}

async function deleteUrl(data) {
  const { urlId } = data;

  let url = await Url.findByPk(urlId, {
    include: [
      {
        model: Business,
        as: "business",
        include: [{ model: Assistant, as: "assistant" }],
      },
    ],
    raw: true,
    nest: true,
  });

  if (!url) return;

  await Url.destroy({
    where: {
      id: urlId,
    },
  });

  const {
    id: businessId,
    assistant: { knowledgeBaseName },
  } = url.business;

  await deleteChunksByUrl(knowledgeBaseName, urlId);

  const filePath = path.join(
    DOCUMENTS_BASE_PATH,
    `${businessId}`,
    `url-${urlId}-preview.png`
  );

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

const TrainService = {
  trainWithUrls,
  trainWithDocuments,
  trainWithChat,
  deleteDocument,
  deleteUrl,
};

module.exports = TrainService;
