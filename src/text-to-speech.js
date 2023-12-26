const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");
const { uploadFile } = require("./google-cloud-storage");

const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./s3-storage");

const MODEL_ID = "eleven_turbo_v2"; //eleven_multilingual_v2
// const MODEL_ID = "eleven_multilingual_v2"; //eleven_multilingual_v2
const SIMILARITY_BOOST = 0.75;
const STABILITY = 0.5;
const USE_SPEAKER_BOOST = false;
const STYLE = 0.0;
// const VOICE_ID = "oWAxZDx7w5VEj9dCyTzz";
// const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; //Rachel
const VOICE_ID = "pqHfZKP75CvOlQylNhV4"; //Bill
// const API_KEY = "a595fbf5f52043a4347ada24eafc6c3d";
const API_KEY = "126cd91db93cc56a188c321abb9d48c5";

const fileExtension = "mp3";

async function convertTextToSpeech(text) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": API_KEY,
      // Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model_id: MODEL_ID,
      text,
      voice_settings: {
        similarity_boost: SIMILARITY_BOOST,
        stability: STABILITY,
        style: STYLE,
        use_speaker_boost: USE_SPEAKER_BOOST,
      },
    }),
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?optimize_streaming_latency=4`,
    options
  );

  const arrayBuffer = await response.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  const fileName = generateFilename(fileExtension);

  // Save the audio file locally
  // const filePath = path.join(__dirname, "..", "public", fileName);
  // fs.writeFileSync(filePath, buffer);

  // const fileUrl = `https://1558-119-73-99-27.ngrok-free.app/public/${fileName}`;
  // // const fileUrl = `https://ai-backend-five.vercel.app/public/${fileName}`;

  // console.log("text-to-speech.....");

  // return fileUrl;

  // return await uploadFile(fileName, arrayBuffer);

  return await uploadToS3(arrayBuffer, fileName);
}

function generateFilename(fileExtension) {
  const uniqueId = uuidv4();

  const timestamp = getUnixTime(new Date());

  const uniqueFilename = `${timestamp}_${uniqueId}.${fileExtension}`;
  return uniqueFilename;
}

async function getElevenLabsModels() {
  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: { "Content-Type": "application/json", "xi-api-key": API_KEY },
  });

  return await response.json();
}

module.exports = { convertTextToSpeech };
