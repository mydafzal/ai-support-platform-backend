const router = require("express").Router();
const { Op } = require("sequelize");
const { ChatUserAssignment } = require("../../models");

const ResponseHandler = require("../utils/response-handler");
const validateRequest = require("../middleware/request-validation.middleware");

const {
  updateChatAssignmentSchema,
} = require("../validators/chat-user-assignment-validator");
const asyncHandler = require("../utils/async-handler");

router.put(
  "/",
  validateRequest(updateChatAssignmentSchema),
  asyncHandler(async (req, res) => {
    const { viewed, userId, chatIds } = req.body;

    await ChatUserAssignment.update(
      {
        viewed,
      },
      {
        where: {
          chatId: {
            [Op.in]: chatIds,
          },
          userId,
        },
      }
    );

    ResponseHandler.success(res, { message: "Update succesful." });
  })
);

module.exports = router;
