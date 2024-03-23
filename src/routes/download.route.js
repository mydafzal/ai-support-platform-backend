const router = require("express").Router();
const path = require("path");
const fs = require("fs/promises");
const { DOCUMENTS_BASE_PATH } = require("../utils/constants");

router.get("/:fileName", async (req, res) => {
  const userId = req?.user?.id || 2;

  const filePath = path.join(
    DOCUMENTS_BASE_PATH,
    `${userId}`,
    req.params.fileName
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
