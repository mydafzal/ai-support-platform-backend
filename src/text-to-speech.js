const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");
const { uploadFile } = require("./google-cloud-storage");

const MODEL_ID = "eleven_turbo_v2"; //eleven_multilingual_v2
// const MODEL_ID = "eleven_multilingual_v2"; //eleven_multilingual_v2
const SIMILARITY_BOOST = 0.5;
const STABILITY = 0.5;
const USE_SPEAKER_BOOST = true;
const STYLE = 0.5;
const VOICE_ID = "oWAxZDx7w5VEj9dCyTzz";
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
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    options
  );

  const arrayBuffer = await response.arrayBuffer();

  const fileName = generateFilename(fileExtension);

  return await uploadFile(fileName, arrayBuffer);
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
