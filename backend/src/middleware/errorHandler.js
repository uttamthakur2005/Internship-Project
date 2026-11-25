const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Resource not found'));
}

function errorHandler(error, req, res, next) {
  let apiError = error;
  if (error?.type === 'entity.parse.failed') {
    apiError = new ApiError(400, 'VALIDATION_ERROR', 'Request body contains invalid JSON');
  } else if (error?.status === 413) {
    apiError = new ApiError(400, 'VALIDATION_ERROR', 'Request body is too large');
  } else if (error instanceof mongoose.Error.ValidationError) {
    apiError = new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }))
    );
  } else if (error instanceof mongoose.Error.CastError) {
    apiError = new ApiError(400, 'VALIDATION_ERROR', `Invalid ${error.path}`);
  } else if (error?.code === 11000) {
    apiError = new ApiError(409, 'DUPLICATE_KEY', 'A record with this value already exists');
  } else if (!(error instanceof ApiError)) {
    console.error(error);
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  const body = {
    success: false,
    error: { code: apiError.code, message: apiError.message }
  };
  if (apiError.details) body.error.details = apiError.details;
  return res.status(apiError.status || 500).json(body);
}

module.exports = { notFound, errorHandler };
