const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

const s3 = new AWS.S3({});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function uploadToS3(file, fileName) {
  const buffer = Buffer.from(file);

  const params = {
    Bucket: BUCKET_NAME,
    Key: `ai-bot/${fileName}`,
    Body: buffer,
    ACL: "public-read",
    ContentType: "audio/mpeg",
  };

  const { Location, Key } = await s3.upload(params).promise();

  console.log("Uploaded to S3 => url: ", Location);
  console.log("key ", Key);
  console.log("url ", `https://${BUCKET_NAME}.s3.amazonaws.com/${Key}`);

  return Location;
}

module.exports = { uploadToS3 };
