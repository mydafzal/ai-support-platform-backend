const { ChromaClient } = require("chromadb");

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");

const client = new ChromaClient();

client.heartbeat().then((result) => {
  console.log("chroma connection status", result);
});

async function addToVectoreStore(collectionName, docs) {
  const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
    collectionName,
    url: "http://localhost:8000",
  });

  console.log("add to chroma - response", vectorStore.collectionName);
}

async function addTextToVectoreStore(text, collectionName) {
  const vectorStore = await Chroma.fromTexts(
    [text],
    [],
    new OpenAIEmbeddings(),
    {
      collectionName: collectionName,
    }
  );

  console.log("add text to chroma - response", vectorStore.collectionName);
}

async function getVectoreStore(collectionName) {
  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings(),
    { collectionName: collectionName }
  );

  return vectorStore;
}

async function deleteCollection(collectionName) {
  const collections = await client.listCollections();

  console.log("collections ", collections?.length);

  if (collections?.length > 0) {
    await Promise.all(
      collections.map((item) => client.deleteCollection({ name: item.name }))
    );
  }
}

async function deleteChunksByUrl(collectionName, urlId) {
  const collection = await client.getCollection({ name: collectionName });

  const result = await collection.delete({
    where: { urlId: `url-${urlId}` },
  });

  console.log("deleteChunksByUrl - result", result);
}

async function deleteChunksByDocument(collectionName, documentId) {
  const collection = await client.getCollection({ name: collectionName });

  const result = await collection.delete({
    where: { documentId: `document-${documentId}` },
  });

  console.log("deleteChunksByDocument - result", result);
}

module.exports = {
  addToVectoreStore,
  addTextToVectoreStore,
  getVectoreStore,
  deleteCollection,
  deleteChunksByDocument,
  deleteChunksByUrl,
};
