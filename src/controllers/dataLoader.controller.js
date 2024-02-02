const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  CheerioWebBaseLoader,
} = require("langchain/document_loaders/web/cheerio");

const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");

const path = require("path");
const { addToVectoreStore } = require("../integrations/chromaDB");

async function scrapeAndPersistData(url, collectionName) {
  // "https://docs.smith.langchain.com/overview"
  // "https://cheetahagency.com/our-history/"

  const loader = new CheerioWebBaseLoader(url);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore(collectionName, docs);
}

async function readFileAndPersistData(filePath, collectionName) {
  // filePath = path.join(__dirname, "..", "..", "sample-file.pdf");

  const fileExtension = path.extname(filePath);
  console.log(`Extension: ${fileExtension}`);

  let loader;
  if (fileExtension === ".pdf") {
    loader = new PDFLoader(filePath);
  } else if (fileExtension === ".txt") {
    loader = new TextLoader(filePath);
  } else if (fileExtension === ".docx") {
    loader = new DocxLoader(filePath);
  } else if (fileExtension === ".csv") {
    loader = new CSVLoader(filePath);
  }

  // const loader = new PDFLoader(file.buffer);
  const rawDocs = await loader.load();

  const docs = await splitDocuments(rawDocs);
  await addToVectoreStore(collectionName, docs);
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
