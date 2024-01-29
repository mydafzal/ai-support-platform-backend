const { createClient } = require("redis");

// const client = createClient({
//   password: "PxoKvHS2vngB0c2yfvm1pRHpntbYNF9m",
//   legacyMode: false,
//   socket: {
//     host: "redis-18874.c321.us-east-1-2.ec2.cloud.redislabs.com",
//     port: 18874,
//   },
// });

const client = createClient();

(() => {
  client.connect().then(() => {
    console.log("connected redis");
  });
})();

async function storeCallData(key, data) {
  try {
    await client.set(key, JSON.stringify(data));
  } catch (error) {
    console.log("storeCallData error", error);
  }
}

async function getCallData(key) {
  const data = await client.get(key);
  return JSON.parse(data);
}

async function deleteCallData(key) {
  await client.del(key);
}

async function updateCallConversation(key, data) {
  return await client.set(key, JSON.stringify(data));
}

module.exports = {
  storeCallData,
  getCallData,
  deleteCallData,
  updateCallConversation,
};
