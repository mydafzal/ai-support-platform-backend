const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  CheerioWebBaseLoader,
} = require("langchain/document_loaders/web/cheerio");

const { PDFLoader } = require("langchain/document_loaders/fs/pdf");

const path = require("path");
const { addToVectoreStore } = require("../integrations/chromaDB");

async function scrapeAndPersistData(url) {
  // "https://docs.smith.langchain.com/overview"
  // "https://cheetahagency.com/our-history/"

  const loader = new CheerioWebBaseLoader(url);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore("test-collection-123", docs);
}

async function readFileAndPersistData(filePath) {
  filePath = path.join(__dirname, "..", "..", "sample-file.pdf");

  const loader = new PDFLoader(filePath);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore("test-collection-123", docs);
}

async function splitDocuments(rawDocs) {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return await splitter.splitDocuments(rawDocs);
  } catch (error) {
    console.log("Error splitting documents", error);
  }
}

module.exports = {
  scrapeAndPersistData,
  readFileAndPersistData,
};
