class ResponseHandler {
  static success(res, { statusCode = 200, data, message, pagination }) {
    return res
      .status(statusCode)
      .json({ success: true, data, message, pagination });
  }

  static error(res, { statusCode = 500, message }) {
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Internal Server Error" : message,
    });
  }
}

module.exports = ResponseHandler;
