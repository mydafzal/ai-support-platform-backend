const ResponseHandler = require("../utils/response-handler");

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
      statusCode,
      message,
    });

    console.error(logMessage);
  } else {
    console.error(logMessage);
    next(err);
  }
};

module.exports = errorHandler;
