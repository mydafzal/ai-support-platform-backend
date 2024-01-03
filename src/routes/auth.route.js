const Router = require("express").Router;
const { generateOAuthUrl, storeAccessToken } = require("../google-oauth");

const router = Router();

router.get("/oauth-url", (req, res) => {
  const oauthUrl = generateOAuthUrl();
  res.status(200).send(oauthUrl);
});

router.post("/oauth-access-token", async (req, res) => {
  const { customerId, code } = req.body;

  await storeAccessToken(customerId, code);
  res.status(200).send("OAuth credentials stored.");
});

module.exports = router;
