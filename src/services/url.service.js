const { Url } = require("../../models");

async function getUrlsByBusiness(data) {
  let { businessId, page = 1, pageSize = 10 } = data;

  const offset = (page - 1) * pageSize;

  let urls = await Url.findAll({
    where: {
      businessId,
    },
    limit: parseInt(pageSize),
    offset: parseInt(offset),
    raw: true,
  });

  const totalCount = await Url.count({
    where: {
      businessId,
    },
  });

  const basePath = `${process.env.BASE_URL}/data/documents/${businessId}`;

  urls = urls.map((item) => ({
    ...item,
    previewUrl: `${basePath}/url-${item.id}-preview.png`,
  }));

  return { urls, pagination: { page, pageSize, totalCount } };
}

const UrlService = { getUrlsByBusiness };
module.exports = UrlService;
