const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(
      new ApiError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.array().map(({ path, msg }) => ({ field: path, message: msg }))
      )
    );
  }
  return next();
}

module.exports = validate;
