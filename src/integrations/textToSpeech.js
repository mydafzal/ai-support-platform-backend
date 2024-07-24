const fetch = require("node-fetch");

const MODEL_ID = "eleven_turbo_v2"; //eleven_multilingual_v2
const SIMILARITY_BOOST = 0.75;
const STABILITY = 0.5;
const USE_SPEAKER_BOOST = false;
const STYLE = 0.0;

async function convertTextToSpeech(text, voiceId) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
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
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4`,
    options
  );

  const arrayBuffer = await response.arrayBuffer();

  // const fileUrl = `https://1558-119-73-99-27.ngrok-free.app/public/${fileName}`;
  // const fileUrl = `https://ai-backend-five.vercel.app/public/${fileName}`;

  return arrayBuffer;
}

async function getElevenLabsModels() {
  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
    },
  });

  return await response.json();
}

async function getElevenLabsVoices() {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/voices?show_legacy=true"
  );
  const data = await response.json();

  return data.voices.map((voice) => ({
    voiceId: voice.voice_id,
    voiceName: voice.name,
    previewUrl: voice.preview_url,
  }));
}

module.exports = { convertTextToSpeech, getElevenLabsVoices };
