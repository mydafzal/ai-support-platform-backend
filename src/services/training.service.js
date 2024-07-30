const fs = require("fs/promises");
const path = require("path");

const { Assistant, Url, Document } = require("../../models");
const {
  scrapeAndPersistData,
  readFileAndPersistData,
} = require("../controllers/dataLoader.controller");
const { redisClient } = require("../integrations/redis");
const { getBrowser } = require("../integrations/urlScreenshot");
const { DOCUMENTS_BASE_PATH } = require("../utils/constants");
const SummarizationService = require("./summarization.service");

async function trainWithUrls(data) {
  try {
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

    urls = await Url.bulkCreate(urls, {
      raw: true,
    });

    let promises = urls.map((url) =>
      scrapeAndPersistData(url.link, assistant.knowledgeBaseName, url.id)
    );

    await Promise.all(promises);

    await captureScreenshotOfWebpages(urls);

    await saveUploadsToTrainingChat("url", urls, businessId);

    return "Data loaded from provided urls.";
  } catch (error) {
    console.error("error uploading urls - ", error);
    throw error;
  }
}

async function captureScreenshotOfWebpages(urls) {
  // path where to save capture screenshots
  const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);

  // create directory if doesn't exist already.
  await fs.mkdir(destinationPath, { recursive: true });

  const browser = getBrowser();

  const promises = urls.map(async (url) => {
    try {
      const page = await browser.newPage();

      await page.goto(url.link);

      await page.screenshot({
        path: `${destinationPath}/url-${url.id}-preview.png`,
      });
    } catch (error) {
      console.log("error taking screenshot.", error);
    }
  });

  await Promise.all(promises);
}

async function trainWithDocuments(data) {
  try {
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

    let documents = await Document.bulkCreate(files, { raw: true });

    const destinationPath = path.join(DOCUMENTS_BASE_PATH, `${businessId}`);
    await fs.mkdir(destinationPath, { recursive: true });

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

      await fs.rename(filePath, `${destinationPath}/${document.name}`);
    });

    await Promise.all(promises);

    await saveUploadsToTrainingChat("document", documents, businessId);

    return "Data loaded from provided files.";
  } catch (error) {
    console.error("error uploading training documents - ", error);
    throw error;
  }
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

      const summary = await SummarizationService.summarizeDocument(
        documentPath
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

    return redisClient.rPush(
      `train-chat-${businessId}`,
      JSON.stringify(message)
    );
  });

  await Promise.all(promises);
}

const TrainingService = { trainWithUrls, trainWithDocuments };

module.exports = TrainingService;
