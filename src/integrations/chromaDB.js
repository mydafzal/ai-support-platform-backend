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
  const collectionToDelete = await client.getCollection({
    name: collectionName,
  });

  const allDocs = await collectionToDelete.get();
  console.log("get result -  ", allDocs.ids);

  const result = await collectionToDelete.delete({ ids: allDocs.ids });
  console.log("deletion result -  ", result);
}

async function deleteAllCollections() {
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

async function getChunksByUrl(collectionName, urlId) {
  const collection = await client.getCollection({ name: collectionName });

  const urlChunks = await collection.get({
    where: { urlId: `url-${urlId}` },
  });

  console.log("urlChunks - ", urlChunks);
  return urlChunks;
}

async function getChunksByDocument(collectionName, documentId) {
  const collection = await client.getCollection({ name: collectionName });

  const documentChunks = await collection.get({
    where: { documentId: `document-${documentId}` },
  });

  console.log("documentChunks - ", documentChunks);
  return documentChunks;
}

module.exports = {
  addToVectoreStore,
  addTextToVectoreStore,
  getVectoreStore,
  deleteCollection,
  deleteChunksByDocument,
  deleteChunksByUrl,
  getChunksByUrl,
  getChunksByDocument,
  deleteAllCollections,
};
