const ResponseHandler = require("../utils/responseHandler");

const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message = "Internal Server Error", stack } = err;

  const logMessage = `
   Error occurred:
   Status Code: ${statusCode}
   Message: ${message}
   Stack Trace: ${stack || "No stack trace available"}
   
   Request Details:
   Method: ${req.method}
   URL: ${req.originalUrl}
   Body: ${JSON.stringify(req.body, null, 2)}
   Headers: ${JSON.stringify(req.headers, null, 2)}
 `;

  if (!res.headersSent) {
    ResponseHandler.error(res, {
      statusCode: err.statusCode || 500,
      message: err.message || "Internal Server Error",
    });

    console.error(logMessage);
  } else {
    console.error(logMessage);
    next(err);
  }
};

module.exports = errorHandler;
