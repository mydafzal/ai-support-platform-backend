const { ChromaClient } = require("chromadb");

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");

const client = new ChromaClient();

client.heartbeat().then((result) => {
  console.log("chroma connection status", result);
});

async function addToVectoreStore(collectionName, docs) {
  const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
    collectionName: "test-collection",
    url: "http://localhost:8000",
  });

  console.log("add to chroma - response", vectorStore);
}

async function addTextToVectoreStore(text, collectionName) {
  const vectorStore = await Chroma.fromTexts(
    [text],
    [{ id: "my-custom-id-123" }],
    new OpenAIEmbeddings(),
    {
      collectionName: collectionName || "conversation-flows",
    }
  );

  console.log("add text to chroma - response", vectorStore.collectionName);
}

async function getVectoreStore(collectionName) {
  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings(),
    { collectionName: collectionName || "test-collection" }
  );

  return vectorStore;
}

async function deleteCollection(collectionName) {
  const collections = await client.listCollections();

  console.log("collections ", collections);

  await client.deleteCollection({ name: "test-collection" });
}

module.exports = {
  addToVectoreStore,
  addTextToVectoreStore,
  getVectoreStore,
  deleteCollection,
};
