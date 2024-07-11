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
const CHAT_WIDGET_LOGOS_BASE_URL = `${process.env.BASE_URL}/data/chat-widget-logos`;
const CHAT_UPLOADS_BASE_URL = `${process.env.BASE_URL}/data/chat-uploads`;
const PROFILE_IMAGES_BASE_URL = `${process.env.BASE_URL}/data/profile-images`;

const HUBPOST_INTEGRATION_ID = 1;
const GOOGLE_CALENDAR_INTEGRATION_ID = 2;
const CALENDLY_INTEGRATION_ID = 3;

// Pricing Plans IDs:
const FREE_PLAN_ID = 1;
const PRO_PLAN_ID = 2;
const ENTERPRISE_PLAN_ID = 3;

// Pricing Plans's Feature IDs:
const FREE_PHONE_FEATURE_ID = 1;
const CALL_MINUTES_FEATURE_ID = 2;
const MEETING_FEATURE_ID = 3;
const TEAM_MEMBERS_FEATURE_ID = 4;
const CHATS_FEATURE_ID = 5;
const POWERED_BY_FEATURE_ID = 6;
const COMPANIES_FEATURE_ID = 7;

// User statuses:
const ACCEPTING_CHATS = "Accepting chats";
const NOT_ACCEPTING_CHATS = "Not accepting chats";
const OFFLINE = "Offline";

const CARD_BRAND_LOGOS = {
  visa: "https://res.cloudinary.com/dydgf5aoh/image/upload/v1720189530/customer-bot-images/stn8n14fri1ikmmr47py.png",
  "American Express":
    "https://res.cloudinary.com/dydgf5aoh/image/upload/v1720189530/customer-bot-images/tmew6l5nplo7ncpgsw5n.png",
  mastercard:
    "https://res.cloudinary.com/dydgf5aoh/image/upload/v1720189530/customer-bot-images/w5mk5dqlkanh1kkq7fay.png",
  discover:
    "https://res.cloudinary.com/dydgf5aoh/image/upload/v1720189530/customer-bot-images/jlgmik5jbrgbsgdo0se2.png",
};

module.exports = {
  AUDIO_FILES_BASE_PATH,
  AUDIO_FILES_EXTENSION,
  AUDIO_FILES_BASE_URL,
  DOCUMENTS_BASE_PATH,
  STORAGE_BASE_PATH,
  CALL_RECORDINGS_BASE_PATH,
  HUBPOST_INTEGRATION_ID,
  CALENDLY_INTEGRATION_ID,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  CHAT_WIDGET_LOGOS_BASE_URL,
  CHAT_UPLOADS_BASE_URL,
  ACCEPTING_CHATS,
  NOT_ACCEPTING_CHATS,
  OFFLINE,
  PROFILE_IMAGES_BASE_URL,
  FREE_PLAN_ID,
  PRO_PLAN_ID,
  ENTERPRISE_PLAN_ID,
  FREE_PHONE_FEATURE_ID,
  CALL_MINUTES_FEATURE_ID,
  MEETING_FEATURE_ID,
  COMPANIES_FEATURE_ID,
  TEAM_MEMBERS_FEATURE_ID,
  CHATS_FEATURE_ID,
  POWERED_BY_FEATURE_ID,
  CARD_BRAND_LOGOS,
};
