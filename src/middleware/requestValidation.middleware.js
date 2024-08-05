const ResponseHandler = require("../utils/responseHandler");

const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    return ResponseHandler.error(res, {
      statusCode: 400,
      message: err.errors.map((error) => ({
        path: error.path,
        message: error.message,
      })),
    });
  }
};

module.exports = validateRequest;
