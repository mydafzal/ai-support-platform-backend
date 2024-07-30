const ResponseHandler = require("../utils/responseHandler");

const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse({ ...req.body, files: req.files });
    next();
  } catch (err) {
    return ResponseHandler.error(
      res,
      400,
      err.errors.map((error) => ({
        path: error.path,
        message: error.message,
      }))
    );
  }
};

module.exports = validateRequest;
