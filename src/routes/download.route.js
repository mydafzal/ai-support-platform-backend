const router = require("express").Router();
const path = require("path");
const fs = require("fs/promises");
const { DOCUMENTS_BASE_PATH } = require("../utils/constants");

const { Document } = require("../../models");

router.get("/:id", async (req, res) => {
  const documentId = req.params.id;

  let document = await Document.findByPk(documentId);

  if (!document) {
    return res
      .status(404)
      .json({ success: false, message: "Invalid document id" });
  }

  document = document.toJSON();

  const filePath = path.join(
    DOCUMENTS_BASE_PATH,
    `${document.businessId}`,
    document.name
  );

  try {
    const data = await fs.readFile(filePath);

    res.setHeader("Content-Disposition", "attachment");
    res.status(200).send(data);
  } catch (error) {
    console.error("Error downloading file: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
