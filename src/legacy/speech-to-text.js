const speech = require("@google-cloud/speech");
const got = require("got").default;

const projectId = "";

const client = new speech.SpeechClient({
  projectId,
  keyFilename: "./keyfile.json",
});

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function convertSpeechToText(recordingUrl) {
  const auth = `${ACCOUNT_SID}:${AUTH_TOKEN}`;
  const base64Auth = Buffer.from(auth).toString("base64");

  let file;
  try {
    file = await got.get(recordingUrl, {
      headers: {
        Authorization: `Basic ${base64Auth}`,
      },
    });
  } catch (error) {
    console.log("errrrrr", error);
    return false;
  }

  if (!file) return false;

  const audio = {
    content: file.rawBody,
  };

  const config = {
    encoding: "LINEAR16",
    languageCode: "en-US",
  };

  const request = {
    audio: audio,
    config: config,
  };

  const [response] = await client.recognize(request);

  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");

  return transcription;
}

module.exports = { convertSpeechToText };
