const { BlobServiceClient } = require("@azure/storage-blob");

const key =
  "BpY/qs2L3bws9QLL6rUxPmbtNUntYVtePfgm3JM5+jtp6mIX/EEBl7KnKfbG4TQ252ptnBTq0OnF+AStbNMfUw==";
const connectionString =
  "DefaultEndpointsProtocol=https;AccountName=chatbotagent;AccountKey=BpY/qs2L3bws9QLL6rUxPmbtNUntYVtePfgm3JM5+jtp6mIX/EEBl7KnKfbG4TQ252ptnBTq0OnF+AStbNMfUw==;EndpointSuffix=core.windows.net";
const containerName = "chatbotagent";

async function uploadToBlobStorage(fileContent) {
  fileContent = Buffer.from(fileContent);

  console.log("filecontent", fileContent);

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);
  //   console.log("file", req.file);

  await containerClient.createIfNotExists({});

  //   await containerClient.deleteIfExists();
  //   console.log("req.user - upload", req.user);

  //   const resposne = await containerClient.exists();

  //   console.log("Exists", resposne);

  const blockBlobClient = containerClient.getBlockBlobClient("file2.mp3");

  //   const uploadResult = await blockBlobClient.upload(
  //     fileContent,
  //     fileContent.length
  //   );

  const uploadResult = await blockBlobClient.upload(
    fileContent,
    fileContent.length
  );

  console.log("uploadResult", uploadResult);
  console.log("url", blockBlobClient.url);
}

module.exports = { uploadToBlobStorage };
