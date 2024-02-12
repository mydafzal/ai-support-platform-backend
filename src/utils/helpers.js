const { getUnixTime } = require("date-fns");
const { v4: uuidv4 } = require("uuid");

function generateFilename(fileExtension) {
  const uniqueId = uuidv4();

  const timestamp = getUnixTime(new Date());

  const uniqueFilename = `${timestamp}_${uniqueId}.${fileExtension}`;
  return uniqueFilename;
}

module.exports = { generateFilename };
