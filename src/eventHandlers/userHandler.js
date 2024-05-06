const { User } = require("../../models");
const { ACCEPTING_CHATS } = require("../utils/constants");

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
      id: userId,
    },
  }).then((user) => {
    if (!user) return;

    user = user.toJSON();

    const roomName = `team-${user.businessId}`;
    socket.join(roomName);

    socket
      .to(roomName)
      .emit("user:update-availability", { userId, status: ACCEPTING_CHATS });
  });

  socket.on("user:update-availability", updateAvailabilityStatus);
};
