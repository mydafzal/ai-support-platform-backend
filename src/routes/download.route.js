const router = require("express").Router();
const path = require("path");
const fs = require("fs/promises");

router.get("/download/:fileName", async (req, res) => {
  const userId = 1;

  const filePath = path.join(
    __dirname,
    "documents",
    `${userId}`,
    req.params.fileName
  );

  const data = await fs.readFile(filePath);

  res.setHeader("Content-Disposition", "attachment");
  res.status(200).send(data);
});

module.exports = router;
