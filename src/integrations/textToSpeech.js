const fetch = require("node-fetch");
const FormData = require("form-data");

const fs = require("fs");

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

async function getElevenLabsVoices(userId) {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/voices?show_legacy=true",
    {
      headers: {
        "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
      },
    }
  );
  const data = await response.json();

  if (userId) {
    data.voices = data.voices.filter(
      (voice) =>
        voice.category === "premade" ||
        (voice.category === "cloned" && voice.labels.userId == userId)
    );
  }

  return data.voices.map((voice) => ({
    voiceId: voice.voice_id,
    voiceName: voice.name,
    previewUrl: voice.preview_url,
    category: voice.category,
  }));
}

async function cloneVoice(filePath, voiceName, userId) {
  const file = fs.createReadStream(filePath);

  const labels = {
    userId: `${userId}`,
  };

  const formdata = new FormData();
  formdata.append("name", voiceName);
  formdata.append("files", file);
  formdata.append("labels", JSON.stringify(labels));

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
    },
    body: formdata,
  });

  const voice = await response.json();

  console.log("cloned voice - ", voice);

  return voice.voice_id;
}

async function deleteVoice(voiceId) {
  await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    headers: {
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
    },
    method: "DELETE",
  });
}

module.exports = {
  convertTextToSpeech,
  getElevenLabsVoices,
  cloneVoice,
  deleteVoice,
};
