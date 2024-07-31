const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");

const { WebBrowser } = require("langchain/tools/webbrowser");
const { loadSummarizationChain } = require("langchain/chains");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");

async function summarizeWebpage(url) {
  const model = new ChatOpenAI({ temperature: 0 });

  const embeddings = new OpenAIEmbeddings();

  const browser = new WebBrowser({ model, embeddings });
  return await browser.invoke(url);
}

async function summarizeDocument(filePath, fileExtension) {
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

  // const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const model = new ChatOpenAI({ temperature: 0 });

  const chain = loadSummarizationChain(model, {
    type: "map_reduce",
  });

  const result = await chain.invoke({
    input_documents: docs,
  });

  return result?.text;
}

const SummarizationService = { summarizeWebpage, summarizeDocument };

module.exports = SummarizationService;
