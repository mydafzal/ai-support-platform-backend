const { ChromaClient, OpenAIEmbeddingFunction } = require("chromadb");

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");

const client = new ChromaClient();

client.heartbeat().then((result) => {
  console.log("chroma connection status", result);
});

// const embedder = new OpenAIEmbeddingFunction({
//   openai_api_key: process.env.OPENAI_API_KEY,
// });

async function addToVectoreStore(collectionName, docs) {
  //   const collection = await client.createCollection({
  //     name: "my_collection",
  //     embeddingFunction: embedder,
  //   });

  //   const response = await collection.add({
  //     ids: ["id1", "id2"],
  //     metadatas: [{ source: "my_source" }, { source: "my_source" }],
  //     documents: ["This is a document", "This is another document"],
  //   });

  const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
    collectionName: "test-collection",
    url: "http://localhost:8000", // Optional, will default to this value
  });

  console.log("add to chroma - response", vectorStore);
}

async function addTextToVectoreStore(text) {
  const vectorStore = await Chroma.fromTexts(
    [text],
    [{ id: "my-custom-id-123" }],
    new OpenAIEmbeddings(),
    {
      collectionName: "conversation-flows",
    }
  );

  console.log("add text to chroma - response", vectorStore.collectionName);
}

async function getVectoreStore(collectionName) {
  //   const collection = await client.getCollection({ name: "my_collection" });

  //   const response = await collection.get({
  //     ids: ["id1", "id2"], //ids
  //     // where: { style: "style1" }, // where
  //   });

  //   console.log("get data from chroma - response", response);

  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings(),
    // { collectionName: "godel-escher-bach" }
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
