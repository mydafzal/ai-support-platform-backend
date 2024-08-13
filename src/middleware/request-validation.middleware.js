const ResponseHandler = require("../utils/response-handler");

const validateRequest =
  (schema, dataToValidate = "body") =>
  (req, res, next) => {
    try {
      if (dataToValidate === "body") {
        schema.parse(req.body);
      } else if (dataToValidate === "query") {
        schema.parse(req.query);
      } else if (dataToValidate === "params") {
        schema.parse(req.params);
      }

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
