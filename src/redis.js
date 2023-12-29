const { createClient } = require("redis");

const client = createClient({
  password: "PxoKvHS2vngB0c2yfvm1pRHpntbYNF9m",
  socket: {
    host: "redis-18874.c321.us-east-1-2.ec2.cloud.redislabs.com",
    port: 18874,
  },
});

(() => {
  client.connect().then(() => {
    console.log("connected redis");
  });
})();

async function storeCallData(key, data) {
  await client.hSet(key, data);
}

async function getCallData(key) {
  return await client.hGetAll(key);
}

async function deleteCallData(key) {
  await client.del(key);
}

async function updateCallConversation(key, updatedConversation) {
  return await client.hSet(key, "conversation", updatedConversation);
}

module.exports = {
  storeCallData,
  getCallData,
  deleteCallData,
  updateCallConversation,
};
