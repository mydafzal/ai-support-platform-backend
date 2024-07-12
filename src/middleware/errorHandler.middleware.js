const ResponseHandler = require("../utils/responseHandler");

const errorHandler = (err, req, res, next) => {
  if (!res.headersSent) {
    ResponseHandler.error(res, 500, "Internal Server Error");
  } else {
    next(err);
  }
};

module.exports = errorHandler;
