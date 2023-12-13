const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: "AKIARQEZ7TXVMYQM23IY",
  secretAccessKey: "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",
  region: "us-east-1",
});

const s3 = new AWS.S3({});

const bucketName = "psychix";

async function uploadToS3(file, fileName) {
  const buffer = Buffer.from(file);

  const params = {
    Bucket: bucketName,
    Key: `ai-bot/${fileName}`,
    Body: buffer,
    ACL: "public-read",
    ContentType: "audio/mpeg",
  };

  const { Location, Key } = await s3.upload(params).promise();

  console.log("Uploaded to S3 => url: ", Location);
  console.log("key ", Key);
  console.log("url ", `https://${bucketName}.s3.amazonaws.com/${Key}`);

  return Location;
}

module.exports = { uploadToS3 };
