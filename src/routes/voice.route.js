const router = require("express").Router();
const {
  getElevenLabsVoices,
  deleteVoice,
} = require("../integrations/textToSpeech");

const validateRequest = require("../middleware/request-validation.middleware");
const asyncHandler = require("../utils/async-handler");
const ResponseHandler = require("../utils/response-handler");

const { Assistant } = require("../../models");

const { userIdSchema } = require("../validators/user.validator");

router.get(
  "/",
  validateRequest(userIdSchema, "query"),
  asyncHandler(async (req, res) => {
    const voices = await getElevenLabsVoices(req.query.id);
    ResponseHandler.success(res, { data: voices });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const voiceId = req.params.id;

    const count = await Assistant.count({
      where: {
        voiceId,
      },
      raw: true,
    });

    if (count > 0) {
      return ResponseHandler.error(res, {
        statusCode: 400,
        message:
          "You have one or more companies using this voice. To delete this voice, change the AI voice of companies using this voice.",
      });
    }

    await deleteVoice(voiceId);
    ResponseHandler.success(res, { statusCode: 204 });
  })
);

module.exports = router;
