class ResponseHandler {
  static success(res, data = null, message = null) {
    return res.status(200).json({ success: true, data, message });
  }

  static error(res, statusCode, message) {
    return res.status(statusCode).json({ success: false, message });
  }

  static internalServerError(res) {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}

module.exports = ResponseHandler;
