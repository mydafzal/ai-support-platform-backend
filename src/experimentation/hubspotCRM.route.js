const Router = require("express").Router;
const router = Router();
const fs = require("fs");
const path = require("path");

// const { getContactByPhoneNumber } = require("../integrations/hubspotCRM");

// router.post("/contacts", async (req, res) => {
//   const { phone } = req.body;

//   const filePath = path.join(__dirname, "token.json");
//   const token = fs.readFileSync(filePath, { encoding: "utf-8" });
//   const { accessToken, refreshToken, expirationTime } = JSON.parse(token);

//   const response = await getContactByPhoneNumber(
//     accessToken,
//     refreshToken,
//     expirationTime,
//     phone
//   );

//   console.log("hubspot oauth call", response);

//   res.status(200).json({ response });
// });

module.exports = router;
