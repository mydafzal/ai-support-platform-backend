const { Server } = require("socket.io");
const {
  registerUserHandlers,
  registerChatHandlers,
} = require("../eventHandlers");

const { User } = require("../../models");
const { isValidInteger } = require("../utils/helpers");
const { ACCEPTING_CHATS } = require("../utils/constants");

let io = null;

module.exports = {
  initializeSocketIO: function (httpServer) {
    io = new Server(httpServer);

    io.on("connection", (socket) => {
      const userId = socket.request._query.userId;

      // Each user joins their private room.
      socket.join(userId);

      if (isValidInteger(userId)) {
        User.findOne({
          where: {
            id: userId,
          },
        }).then((user) => {
          if (!user) return;

          user = user.toJSON();

          User.update(
            {
              status: ACCEPTING_CHATS,
            },
            {
              where: {
                id: userId,
              },
            }
          );

          // Each user joins a team room so that events can be broadcast to all team members.
          const roomName = `team-${user.businessId}`;
          socket.join(roomName);

          socket.to(roomName).emit("user:update-availability", {
            userId,
            status: ACCEPTING_CHATS,
          });
        });
      }

      registerUserHandlers(io, socket);
      registerChatHandlers(io, socket);
    });
  },

  getSocketIOInstance: function () {
    return io;
  },
};
