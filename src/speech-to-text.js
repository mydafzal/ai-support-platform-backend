const speech = require("@google-cloud/speech");
const got = require("got").default;

const projectId = "riderz-1669024061001";

const client = new speech.SpeechClient({
  projectId,
  keyFilename: "./keyfile.json",
});

const accountSid = "AC38de205937ab33d281c52f95f796107b";
const authToken = "d2d93597795c1f90612e073e5ce413a8";

async function convertSpeechToText(recordingUrl) {
  const auth = `${accountSid}:${authToken}`;
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

  console.log("file", file.rawBody);

  const audio = {
    content: file.rawBody,
  };

  const config = {
    encoding: "LINEAR16",
    // sampleRateHertz: 16000,
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

  console.log(`Transcription: ${transcription}`);

  return transcription;
}

module.exports = { convertSpeechToText };
