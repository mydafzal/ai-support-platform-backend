const { ADJECTIVES, FIRST_NAMES, LAST_NAMES } = require("./data");

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const nameGenerator = () => {
  return rand(ADJECTIVES) + rand(FIRST_NAMES) + rand(LAST_NAMES);
};

module.exports = { nameGenerator };
