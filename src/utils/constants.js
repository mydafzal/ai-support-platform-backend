const path = require("path");

const STORAGE_BASE_PATH = path.join(__dirname, "..", "..", "data");
const DOCUMENTS_BASE_PATH = path.join(STORAGE_BASE_PATH, "documents");
const AUDIO_FILES_BASE_PATH = path.join(
  STORAGE_BASE_PATH,
  "ai-generated-speeches"
);
const CALL_RECORDINGS_BASE_PATH = path.join(
  STORAGE_BASE_PATH,
  "call-recordings"
);
const AUDIO_FILES_EXTENSION = "mp3";
const AUDIO_FILES_BASE_URL = `${process.env.BASE_URL}/data/ai-generated-speeches`;

module.exports = {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_EXTENSION,
  AUDIO_FILES_BASE_URL,
  DOCUMENTS_BASE_PATH,
  STORAGE_BASE_PATH,
  CALL_RECORDINGS_BASE_PATH,
};
