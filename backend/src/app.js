const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: false
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  if (
    req.path.startsWith('/api') &&
    ['POST', 'PATCH', 'PUT'].includes(req.method) &&
    (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))
  ) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object'));
  }
  if (req.path.startsWith('/api') && Object.values(req.query).some((value) => typeof value !== 'string')) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'Query parameters must be single string values'));
  }
  return next();
});
app.use((req, res, next) => {
  const hasBody = Boolean(req.get('transfer-encoding') || Number(req.get('content-length') || 0) > 0);
  if (
    req.path.startsWith('/api') &&
    hasBody &&
    !req.is('application/json') &&
    ['POST', 'PATCH', 'PUT'].includes(req.method)
  ) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'Content-Type must be application/json'));
  }
  return next();
});
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Login rate limit exceeded' }
    }
  })
);
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
