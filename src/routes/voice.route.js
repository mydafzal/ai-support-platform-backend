const router = require("express").Router();
const { getElevenLabsVoices } = require("../integrations/textToSpeech");

router.get("/", async (req, res) => {
  try {
    const voices = await getElevenLabsVoices();
    res.status(200).json({ success: true, data: voices });
  } catch (error) {
    console.error("Error getting voices", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
