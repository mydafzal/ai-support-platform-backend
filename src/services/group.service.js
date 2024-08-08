const { Invitation, Chat, Group, User } = require("../../models");

const sequelize = require("sequelize");

async function getGroupsByBusiness(data) {
  const { businessId } = data;

  return await Group.findAll({
    where: { businessId },
    attributes: [
      "id",
      "name",
      [sequelize.fn("COUNT", sequelize.col("users.id")), "userCount"],
      [
        sequelize.literal(`(
          SELECT COUNT(*)
          FROM "Invitations"
          WHERE "Invitations"."groupId" = "group"."id"
          AND NOT EXISTS (
            SELECT 1
            FROM "Users"
            WHERE "Users"."groupId" = "group"."id"
            AND "Users"."email" = "Invitations"."email"
          )
        )`),
        "invitationCount",
      ],
      [sequelize.fn("COUNT", sequelize.col("chats.id")), "chatCount"],
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
      {
        model: Chat,
        attributes: [],
        as: "chats",
        through: {
          attributes: [],
        },
      },
    ],
    group: ["Group.id"],
  });
}

const GroupService = { getGroupsByBusiness };
module.exports = GroupService;
