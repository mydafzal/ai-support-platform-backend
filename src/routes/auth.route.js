const Router = require("express").Router;
const { generateOAuthUrl, storeAccessToken } = require("../google-oauth");

const router = Router();

router.get("/oauth-url", (req, res) => {
  const oauthUrl = generateOAuthUrl();
  res.status(200).send(oauthUrl);
});

router.post("/oauth-access-token", async (req, res) => {
  const { userId, code } = req.body;

  const response = await storeAccessToken(userId, code);
  res.status(200).send(response);
});

module.exports = router;
