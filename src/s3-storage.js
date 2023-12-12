const AWS = require("aws-sdk");

// var credentials = new AWS.SharedIniFileCredentials();
// AWS.config.credentials.accessKeyId = `AKIARQEZ7TXVMYQM23IY`;
// AWS.config.region = "us-east-1";
// AWS.config.credentials.secretAccessKey = `je6GytfKU2VhqNtaGQ8feMTi8d74gE0t2TMkQdAe`;

AWS.config.update({
  accessKeyId: "AKIARQEZ7TXVMYQM23IY",
  // key: "YOUR_ACCESS_KEY_ID",
  secretAccessKey: "je6GytfKU2VhqNtaGQ8feMTi8d74gE0t2TMkQdAe",
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

  s3.upload(params, (err, data) => {
    if (err) {
      console.error("Error uploading to S3:", err);
    } else {
      console.log("Successfully uploaded to S3:", data.Location);
    }
  });
}

module.exports = { uploadToS3 };
