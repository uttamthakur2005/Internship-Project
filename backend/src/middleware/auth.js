const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { effectivePermissions } = require('../config/permissions');

async function protect(req, res, next) {
  try {
    const authorization = req.get('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED';
      throw new ApiError(401, code, 'Invalid or expired authentication token');
    }

    const user = await User.findById(payload.sub).select('+passwordHash');
    if (!user || !user.isActive) throw new ApiError(401, 'ACCOUNT_INACTIVE', 'Account is inactive');
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication token has been revoked');
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: effectivePermissions(user),
      extraPermissions: user.extraPermissions
    };
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user?.permissions.includes(permission)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { protect, requirePermission };
