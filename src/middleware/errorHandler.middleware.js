const ResponseHandler = require("../utils/responseHandler");

const errorHandler = (err, req, res, next) => {
  if (!res.headersSent) {
    ResponseHandler.error(res, {
      statusCode: err.statusCode || 500,
      message: err.message || "Internal Server Error",
    });
  } else {
    next(err);
  }
};

module.exports = errorHandler;
