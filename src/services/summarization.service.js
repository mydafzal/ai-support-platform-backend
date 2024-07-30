const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");

const { WebBrowser } = require("langchain/tools/webbrowser");
const { loadSummarizationChain } = require("langchain/chains");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");

async function summarizeWebpage(url) {
  const model = new ChatOpenAI({ temperature: 0 });

  const embeddings = new OpenAIEmbeddings();

  const browser = new WebBrowser({ model, embeddings });
  return await browser.invoke(url);
}

async function summarizeDocument(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const model = new ChatOpenAI({ temperature: 0 });

  const chain = loadSummarizationChain(model, {
    type: "map_reduce",
  });

  return await chain.invoke({
    input_documents: docs,
  });
}

const SummarizationService = { summarizeWebpage, summarizeDocument };

module.exports = SummarizationService;
