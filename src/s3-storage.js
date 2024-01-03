const AWS = require("aws-sdk");
const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");

AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

const s3 = new AWS.S3({});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const fileExtension = "mp3";

async function uploadToS3(file, customerId, fileName) {
  if (!fileName) {
    fileName = generateFilename(fileExtension);
  }

  const buffer = Buffer.from(file);
  const filePath = `ai-bot/customer-${customerId}/${fileName}`;

  const params = {
    Bucket: BUCKET_NAME,
    // Key: `ai-bot/${fileName}`,
    Key: filePath,
    Body: buffer,
    ACL: "public-read",
    ContentType: "audio/mpeg",
  };

  const { Location } = await s3.upload(params).promise();
  console.log("Uploaded to S3 => url: ", Location);

  return Location;
}

function generateFilename(fileExtension) {
  const uniqueId = uuidv4();
  const timestamp = getUnixTime(new Date());

  const uniqueFilename = `${timestamp}_${uniqueId}.${fileExtension}`;
  return uniqueFilename;
}

module.exports = { uploadToS3 };
