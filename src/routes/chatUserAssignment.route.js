const router = require("express").Router();
const { Op } = require("sequelize");
const { ChatUserAssignment } = require("../../models");

const { z } = require("zod");

const updateChatAssignmentValidationSchema = z.object({
  viewed: z.boolean(),
  userId: z.number(),
  chatIds: z.array(z.number()),
});

router.put("/", async (req, res) => {
  try {
    const { success, error } =
      await updateChatAssignmentValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

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

    res.status(200).json({
      success: true,
      message: "Update succesful.",
    });
  } catch (error) {
    console.error("Error updating chat user assignment: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
