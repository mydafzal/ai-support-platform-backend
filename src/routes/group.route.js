const router = require("express").Router();

const { z } = require("zod");
const { Group, Business, GroupMembership } = require("../../models");
const { Op } = require("sequelize");

const validateRequest = require("../middleware/request-validation.middleware");
const ResponseHandler = require("../utils/response-handler");
const GroupService = require("../services/group.service");
const asyncHandler = require("../utils/async-handler");

const addGroupSchema = z.object({
  name: z.string(),
  businessId: z.number(),
});

const updateGroupSchema = z.object({
  name: z.string(),
});

const assignGroupToMembersSchema = z.object({
  userIds: z.array(z.number()),
});

router.post(
  "/",
  validateRequest(addGroupSchema),
  asyncHandler(async (req, res) => {
    const { name, businessId } = req.body;

    const business = await Business.findByPk(businessId, { raw: true });

    if (!business) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id" });
    }

    let group = await Group.create({
      name,
      businessId,
    });

    ResponseHandler.success(res, { data: group.toJSON() });
  })
);

router.put(
  "/:id/team-members",
  validateRequest(assignGroupToMembersSchema),
  async (req, res) => {
    const groupId = req.params.id;

    const { userIds } = req.body;

    let group = await Group.findByPk(groupId);

    if (!group) {
      ResponseHandler.error(res, {
        statusCode: 404,
        message: "Invalid group id.",
      });
    }

    if (userIds?.length > 0) {
      await Promise.all(
        userIds.map(async (userId) => {
          const groupMembership = await GroupMembership.findOne({
            where: {
              groupId,
              userId,
            },
            raw: true,
          });

          if (!groupMembership) {
            await GroupMembership.create({ groupId, userId });
          }
        })
      );
    }

    await GroupMembership.destroy({
      where: {
        groupId,
        userId: {
          [Op.notIn]: userIds,
        },
      },
    });

    group = await GroupService.getGroupById({ groupId });

    ResponseHandler.success(res, {
      data: group,
      message: "Updated group of team members.",
    });
  }
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await Group.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  })
);

router.put(
  "/:id",
  validateRequest(updateGroupSchema),
  asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const { name } = req.body;

    await Group.update(
      {
        name,
      },
      {
        where: {
          id: groupId,
        },
      }
    );

    ResponseHandler.success(res, { message: "Group updated." });
  })
);

module.exports = router;
