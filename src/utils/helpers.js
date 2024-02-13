const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");

const { RedisChatMessageHistory } = require("langchain/stores/message/redis");

function generateFilename(fileExtension) {
  const uniqueId = uuidv4();

  const timestamp = getUnixTime(new Date());

  const uniqueFilename = `${timestamp}_${uniqueId}.${fileExtension}`;
  return uniqueFilename;
}

class ExtendedRedisChatMemory extends RedisChatMessageHistory {
  async addMessage(message) {
    message.additional_kwargs = {
      timestamp: new Date().getTime(),
    };

    await super.addMessage(message);
  }
}

module.exports = { generateFilename, ExtendedRedisChatMemory };
