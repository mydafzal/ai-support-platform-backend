const { Server } = require("socket.io");
const { registerUserHandlers, registerChatHandlers } = require("../eventHandlers");

let io = null;

module.exports = {
  initializeSocketIO: function (httpServer) {
    io = new Server(httpServer);

    io.on("connection", (socket) => {
      registerUserHandlers(io, socket);
      registerChatHandlers(io, socket);
    });
  },

  getSocketIOInstance: function () {
    return io;
  },
};
