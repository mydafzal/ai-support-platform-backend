const { createClient } = require("redis");

const client = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    port: process.env.REDIS_PORT,
  },
});

// const URL =
//   process.env.NODE_ENV === "development"
//     ? `redis://localhost:${process.env.REDIS_PORT}`
//     : `redis://:${process.env.REDIS_PASSWORD}@127.0.0.1:${process.env.REDIS_PORT}`;

// const client = createClient({
//   url: URL,
// });

async function connectRedis() {
  await client.connect();
  console.log("connected redis");
}

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
  connectRedis,
  storeCallData,
  getCallData,
  deleteCallData,
  updateCallConversation,
  redisClient: client,
};
