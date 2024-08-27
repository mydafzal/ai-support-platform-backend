const { Document } = require("../../models");

async function getDocumentsByBusiness(data) {
  let { businessId, page = 1, pageSize = 10 } = data;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  const offset = (page - 1) * pageSize;

  let documents = await Document.findAll({
    where: {
      businessId,
    },
    limit: parseInt(pageSize),
    offset: parseInt(offset),
    raw: true,
  });

  const totalCount = await Document.count({
    where: {
      businessId,
    },
  });

  return { documents, pagination: { page, pageSize, totalCount } };
}

const DocumentService = { getDocumentsByBusiness };
module.exports = DocumentService;
