const { CallTag } = require("../../models");

async function getCallTagsByBusiness(data) {
  let { businessId } = data;

  return await CallTag.findAll({
    where: { businessId },
    raw: true,
  });
}

const CallTagService = {
  getCallTagsByBusiness,
};

module.exports = CallTagService;
