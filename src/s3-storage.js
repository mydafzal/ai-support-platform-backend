const AWS = require("aws-sdk");

var credentials = new AWS.SharedIniFileCredentials();
AWS.config.credentials = credentials;
// AWS.config.region = regio

// AWS.config.update({
//   key: "YOUR_ACCESS_KEY_ID",
//   secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
//   region: "YOUR_AWS_REGION",
// });

const s3 = new AWS.S3();

const bucketName = "YOUR_S3_BUCKET_NAME";

async function uploadToS3(file, fileName) {
  const buffer = Buffer.from(file);

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ACL: "public-read",
  };

  const { Location } = await s3.upload(params).promise();

  console.log("Uploaded to S3 => url: ", Location);

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
