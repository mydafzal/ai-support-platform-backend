const router = require("express").Router();
const { CallTag, Call, Business } = require("../../models");

const validateRequest = require("../middleware/request-validation.middleware");
const {
  addCallTagSchema,
  callTaggingSchema,
} = require("../validators/call-tag.validator");

const ResponseHandler = require("../utils/response-handler");
const asyncHandler = require("../utils/async-handler");

router.post(
  "/",
  validateRequest(addCallTagSchema),
  asyncHandler(async (req, res) => {
    const business = await Business.findByPk(req.body.businessId, {
      raw: true,
    });

    if (!business) {
      ResponseHandler.error(res, {
        statusCode: 404,
        message: "Invalid business id ",
      });
    }

    let callTag = await CallTag.create(req.body);

    ResponseHandler.success(res, { data: callTag });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await CallTag.destroy({
      where: {
        id: req.params.id,
      },
    });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.put(
  "/:id",
  validateRequest(callTaggingSchema),
  asyncHandler(async (req, res) => {
    const { callIds } = req.body;

    await Call.update(
      { callTagId: req.params.id },
      {
        where: {
          id: callIds,
        },
      }
    );

    ResponseHandler.success(res, { message: "Calls added to tag." });
  })
);

module.exports = router;
