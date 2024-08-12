const { Invitation, Chat, Group, User } = require("../../models");

const sequelize = require("sequelize");

async function getGroupsByBusiness(data) {
  const { businessId } = data;

  // Subqueries for counts
  const chatCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "ChatGroupAssignments" AS "ChatGroupAssignments"
   WHERE "ChatGroupAssignments"."groupId" = "Group"."id")
`);

  const userCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "GroupMemberships" AS "GroupMemberships"
   WHERE "GroupMemberships"."groupId" = "Group"."id")
`);

  const invitationCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "Invitations" AS "Invitations"
   WHERE "Invitations"."groupId" = "Group"."id")
`);

  return await Group.findAll({
    where: { businessId },
    attributes: [
      "id",
      "name",
      [chatCountSubquery, "chatCount"],
      [userCountSubquery, "userCount"],
      [invitationCountSubquery, "invitationCount"],
    ],
    include: [
      {
        model: Chat,
        as: "chats",
        attributes: [],
        through: {
          attributes: [],
        },
        required: false, // Optional: to include groups even if they have no chats
      },
      {
        model: User,
        as: "users",
        attributes: [],
        through: {
          attributes: [],
        },
        required: false, // Optional: to include groups even if they have no users
      },
      {
        model: Invitation,
        as: "invitations",
        attributes: [],
        required: false, // Optional: to include groups even if they have no invitations
      },
    ],
    group: ["Group.id"],
  });
}

async function getGroupById(data) {
  const { groupId } = data;

  // Subqueries for counts
  const chatCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "ChatGroupAssignments" AS "ChatGroupAssignments"
   WHERE "ChatGroupAssignments"."groupId" = "Group"."id")
`);

  const userCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "GroupMemberships" AS "GroupMemberships"
   WHERE "GroupMemberships"."groupId" = "Group"."id")
`);

  const invitationCountSubquery = sequelize.literal(`
  (SELECT COUNT(*)
   FROM "Invitations" AS "Invitations"
   WHERE "Invitations"."groupId" = "Group"."id")
`);

  return await Group.findAll({
    where: { id: groupId },
    attributes: [
      "id",
      "name",
      [chatCountSubquery, "chatCount"],
      [userCountSubquery, "userCount"],
      [invitationCountSubquery, "invitationCount"],
    ],
    include: [
      {
        model: Chat,
        as: "chats",
        attributes: [],
        through: {
          attributes: [],
        },
        required: false, // Optional: to include groups even if they have no chats
      },
      {
        model: User,
        as: "users",
        attributes: [],
        through: {
          attributes: [],
        },
        required: false, // Optional: to include groups even if they have no users
      },
      {
        model: Invitation,
        as: "invitations",
        attributes: [],
        required: false, // Optional: to include groups even if they have no invitations
      },
    ],
    group: ["Group.id"],
  });
}

const GroupService = { getGroupsByBusiness, getGroupById };
module.exports = GroupService;
