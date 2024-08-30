const { Call } = require("../../models");
const { redisClient } = require("../integrations/redis");

async function getCallsByBusiness(data) {
  let { businessId, page = 1, pageSize = 10, callTagId } = data;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  const offset = (page - 1) * pageSize;

  let whereCondition = { businessId };
  if (callTagId) {
    whereCondition.callTagId = callTagId;
  }

  let calls = await Call.findAll({
    where: whereCondition,
    limit: parseInt(pageSize),
    offset: parseInt(offset),
    order: [["createdAt", "DESC"]],
    raw: true,
  });

  const totalCount = await Call.count({
    where: whereCondition,
  });

  calls = await Promise.all(
    calls.map(async (call) => {
      let messages = await redisClient.lRange(
        `transcription-${call.id}`,
        0,
        -1
      );

      messages = messages.map((item) => {
        item = JSON.parse(item);

        return {
          type: item?.type,
          content: item?.content,
          timestamp: item?.timestamp,
        };
      });

      return {
        ...call,
        transcription: messages?.reverse(),
      };
    })
  );

  return { calls, pagination: { page, pageSize, totalCount } };
}

const CallService = {
  getCallsByBusiness,
};

module.exports = CallService;
