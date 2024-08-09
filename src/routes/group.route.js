const router = require("express").Router();

const { z } = require("zod");
const { Group, User, Invitation, Business } = require("../../models");
const { Op, Sequelize } = require("sequelize");

const addGroupSchema = z.object({
  name: z.string(),
  businessId: z.number(),
});

const updateGroupSchema = z.object({
  name: z.string(),
});

const assignGroupToMembersSchema = z.object({
  userIds: z.array(z.number()),
  invitationIds: z.array(z.number()),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await addGroupSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

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

    res.status(201).json({ success: true, data: group.toJSON() });
  } catch (error) {
    console.error("Error adding group:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id/team-members", async (req, res) => {
  const groupId = req.params.id;

  try {
    const { success, error } = await assignGroupToMembersSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { userIds, invitationIds } = req.body;

    let group = await Group.findByPk(groupId);

    if (!group) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid group id." });
    }

    if (userIds?.length > 0) {
      await User.update(
        { groupId },
        {
          where: {
            id: {
              [Op.in]: userIds,
            },
          },
        }
      );
    }

    if (invitationIds?.length > 0) {
      await Invitation.update(
        { groupId },
        {
          where: {
            id: {
              [Op.in]: invitationIds,
            },
          },
        }
      );
    }

    group = await Group.findOne({
      where: { id: groupId },
      attributes: [
        "id",
        "name",
        [Sequelize.fn("COUNT", Sequelize.col("users.id")), "userCount"],
        [
          Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Invitations"
            WHERE "Invitations"."groupId" = "Group"."id"
            AND NOT EXISTS (
              SELECT 1
              FROM "Users"
              WHERE "Users"."groupId" = "Group"."id"
              AND "Users"."email" = "Invitations"."email"
            )
          )`),
          "invitationCount",
        ],
      ],
      include: [
        {
          model: User,
          as: "users",
          attributes: [],
        },
        {
          model: Invitation,
          as: "invitations",
          attributes: [],
        },
      ],
      group: ["Group.id"],
      raw: true,
      nest: true,
    });

    res.status(200).json({
      success: true,
      data: group,
      message: "Updated group of team members.",
    });
  } catch (error) {
    console.error("Error adding group:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Group.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const groupId = req.params.id;

  try {
    const { success, error } = await updateGroupSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

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

    res.status(200).json({ success: true, message: "Group updated." });
  } catch (error) {
    console.error("Error updating group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
