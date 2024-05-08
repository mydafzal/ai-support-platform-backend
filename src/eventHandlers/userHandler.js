const { User } = require("../../models");
const { OFFLINE } = require("../utils/constants");
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

  const handleUserDisconnect = async () => {
    if (!isValidInteger(userId)) return;

    await User.update(
      {
        status: OFFLINE,
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
      console.log("Invalid user id.");
      return;
    }

    user = user.toJSON();

    const roomName = `team-${user.businessId}`;
    socket
      .to(roomName)
      .emit("user:update-availability", { userId, status: OFFLINE });
  };

  socket.on("user:update-availability", updateAvailabilityStatus);
  socket.on("disconnect", handleUserDisconnect);
};
