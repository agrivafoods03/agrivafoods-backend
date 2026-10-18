export class ApiResponse {
  constructor(statusCode, data, message = 'Success', meta = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    if (meta) {
      this.meta = meta;
    }
  }

  static success(res, data = null, message = 'Operation successful', statusCode = 200, meta = null) {
    const response = new ApiResponse(statusCode, data, message, meta);
    return res.status(statusCode).json({
      success: response.success,
      message: response.message,
      data: response.data,
      ...(meta && { meta })
    });
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }
}
