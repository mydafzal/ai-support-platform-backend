const { ChromaClient } = require("chromadb");

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");

const client = new ChromaClient({
  path: `http://localhost:${process.env.CHROMA_DB_PORT}`,
});

client.heartbeat().then((result) => {
  console.log("chroma running on port ", process.env.CHROMA_DB_PORT);
  console.log("chroma connection status ", result);
});

async function createChromaDBCollection(collectionName) {
  console.log("collectionName - ", collectionName);

  const newCollection = await client.createCollection({
    name: collectionName,
  });
  console.log("createChromaDBCollection - response", newCollection);
}

async function addToVectoreStore(collectionName, docs) {
  console.log("collectionName - ", collectionName);
  console.log("docs?.[0] - ", docs?.[0]);

  const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
    collectionName,
    url: `http://localhost:${process.env.CHROMA_DB_PORT}`,
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

  await collection.delete({
    where: { urlId: `url-${urlId}` },
  });
}

async function deleteChunksByDocument(collectionName, documentId) {
  const collection = await client.getCollection({ name: collectionName });

  await collection.delete({
    where: { documentId: `document-${documentId}` },
  });
}

module.exports = {
  addToVectoreStore,
  addTextToVectoreStore,
  getVectoreStore,
  deleteCollection,
  deleteChunksByDocument,
  deleteChunksByUrl,
  createChromaDBCollection,
};
