const { DataTypes, Sequelize } = require("sequelize");
const { sequelize } = require("../loaders/db");
const User = require("./user.model");
// const Call = require("./call.model");

const CallGroup = sequelize.define(
  "CallGroup",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {}
);

CallGroup.belongsTo(User, { foreignKey: "userId" });

// // Define a hook on the CallGroups model to delete associated calls when a group is deleted
// CallGroup.addHook("beforeDestroy", async (group, options) => {
//   // Find calls that are only associated with this group
//   const callsToDelete = await Calls.findAll({
//     include: [
//       {
//         model: CallGroup,
//         where: { id: group.id },
//         through: { attributes: [] }, // Exclude join table attributes
//       },
//     ],
//     having: Sequelize.literal("COUNT(*) = 1"), // Only calls in this group
//     group: ["Call.id"], // Group by call ID
//   });

//   // Delete the calls found
//   await Promise.all(callsToDelete.map((call) => call.destroy()));
// });

// CallGroup.sync({ force: true });

module.exports = CallGroup;
