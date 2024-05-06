const { User } = require("../../models");
const { ACCEPTING_CHATS } = require("../utils/constants");
const { isValidInteger } = require("../utils/helpers");

module.exports = (io, socket) => {
  const userId = socket.request._query.userId;

  const updateAvailabilityStatus = async (payload) => {
    const { status } = payload;

    await User.update(
      {
        status,
      },
      {
        where: {
          id: userId,
        },
      }
    );

    let user = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      console.log("invalid user id received.");
      return;
    }

    user.status = status;
    await user.save();

    user = user.toJSON();

    const roomName = `team-${user.businessId}`;
    socket.to(roomName).emit("user:update-availability", { userId, status });
  };

  User.findOne({
    where: {
      id: isValidInteger(userId) ? userId : 0,
    },
  }).then((user) => {
    // Each user joins their private room.
    socket.join(userId);

    if (!user) return;

    user = user.toJSON();

    // Each user join a team room so that events can be broadcast to all team members.
    const roomName = `team-${user.businessId}`;
    socket.join(roomName);

    socket
      .to(roomName)
      .emit("user:update-availability", { userId, status: ACCEPTING_CHATS });
  });

  socket.on("user:update-availability", updateAvailabilityStatus);
};
