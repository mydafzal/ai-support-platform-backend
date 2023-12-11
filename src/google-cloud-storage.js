const { Storage } = require("@google-cloud/storage");

const projectId = "riderz-1669024061001";
const bucketName = "ai-ccript";

const storage = new Storage({
  projectId: projectId,
  keyFilename: "./keyfile.json",
});

async function uploadFile(fileName, arrayBuffer) {
  const buffer = Buffer.from(arrayBuffer);

  // Specify the destination file path in the bucket
  const destination = `eleven-labs/${fileName}`;

  try {
    await storage.bucket(bucketName).file(destination).save(buffer);

    // const url = `https://storage.cloud.google.com/ai-ccript/${destination}`;
    const url = `https://storage.googleapis.com/ai-ccript/${destination}`;
    return url;
  } catch (error) {
    console.error("Error uploading file to google cloud storage:", error);
  }
}

module.exports = { uploadFile };
