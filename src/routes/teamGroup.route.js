const router = require("express").Router();

const { z } = require("zod");
const { TeamGroup, User, Invitation } = require("../../models");
const { Op, Sequelize } = require("sequelize");

const addTeamGroupValidationSchema = z.object({
  name: z.string(),
  businessId: z.number(),
});

const updateTeamGroupValidationSchema = z.object({
  name: z.string(),
});

const assignGroupToMembersValidationSchema = z.object({
  userIds: z.array(z.number()),
  invitationIds: z.array(z.number()),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await addTeamGroupValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, businessId } = req.body;

    let teamGroup = await TeamGroup.create({
      name,
      businessId,
    });

    res.status(201).json({ success: true, data: teamGroup.toJSON() });
  } catch (error) {
    console.error("Error adding teamGroup:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id/team-members", async (req, res) => {
  const teamGroupId = req.params.id;

  try {
    const { success, error } =
      await assignGroupToMembersValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { userIds, invitationIds } = req.body;

    let teamGroup = await TeamGroup.findByPk(teamGroupId);

    if (!teamGroup) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid group id." });
    }

    if (userIds?.length > 0) {
      await User.update(
        { teamGroupId },
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
        { teamGroupId },
        {
          where: {
            id: {
              [Op.in]: invitationIds,
            },
          },
        }
      );
    }

    teamGroup = await TeamGroup.findOne({
      where: { id: teamGroupId },
      attributes: [
        "id",
        "name",
        [Sequelize.fn("COUNT", Sequelize.col("users.id")), "userCount"],
        [
          Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Invitations"
            WHERE "Invitations"."teamGroupId" = "TeamGroup"."id"
            AND NOT EXISTS (
              SELECT 1
              FROM "Users"
              WHERE "Users"."teamGroupId" = "TeamGroup"."id"
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
      group: ["TeamGroup.id"],
    });

    teamGroup = teamGroup?.toJSON();

    res.status(200).json({
      success: true,
      data: teamGroup,
      message: "Updated group of team members.",
    });
  } catch (error) {
    console.error("Error adding teamGroup:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await TeamGroup.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting team group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const teamGroupId = req.params.id;

  try {
    const { success, error } =
      await updateTeamGroupValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name } = req.body;

    await TeamGroup.update(
      {
        name,
      },
      {
        where: {
          id: teamGroupId,
        },
      }
    );

    res.status(200).json({ success: true, message: "Team group updated." });
  } catch (error) {
    console.error("Error updating team group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
