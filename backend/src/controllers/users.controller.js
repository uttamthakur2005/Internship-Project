const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { effectivePermissions } = require('../config/permissions');
const { parseListQuery } = require('../utils/pagination');

function userView(user) {
  const record = user.toObject ? user.toObject() : user;
  delete record.passwordHash;
  return { ...record, permissions: effectivePermissions(record) };
}

async function list(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query, new Set(['name', 'email', 'role', 'createdAt']));
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) {
    if (!['true', 'false'].includes(req.query.isActive)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'isActive must be true or false');
    }
    filter.isActive = req.query.isActive === 'true';
  }
  if (req.query.search) filter.$or = [
    { name: { $regex: escapeRegex(req.query.search), $options: 'i' } },
    { email: { $regex: escapeRegex(req.query.search), $options: 'i' } }
  ];
  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);
  return paginated(res, users.map(userView), page, limit, total);
}

async function create(req, res) {
  rejectUnknown(req.body, ['name', 'email', 'role', 'password', 'phone', 'extraPermissions']);
  if (!['admin', 'manager', 'staff'].includes(req.body.role)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid user role');
  }
  validateExtraPermissions(req.body.role, req.body.extraPermissions || []);
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash,
    role: req.body.role,
    phone: req.body.phone,
    extraPermissions: req.body.extraPermissions || [],
    createdBy: req.user._id
  });
  return success(res, userView(user), 'User created', 201);
}

async function get(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return success(res, userView(user));
}

async function update(req, res) {
  rejectUnknown(req.body, ['name', 'phone', 'role', 'extraPermissions']);
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  const nextRole = req.body.role ?? user.role;
  const nextPermissions = req.body.extraPermissions ?? user.extraPermissions;
  validateExtraPermissions(nextRole, nextPermissions);
  await protectLastActiveAdmin(user, nextRole, user.isActive);
  for (const field of ['name', 'phone', 'role', 'extraPermissions']) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  await user.save();
  return success(res, userView(user), 'User updated');
}

async function updateStatus(req, res) {
  rejectUnknown(req.body, ['isActive']);
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (typeof req.body.isActive !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'isActive must be a boolean');
  }
  if (!req.body.isActive && String(user._id) === String(req.user._id)) {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'You cannot deactivate your own account');
  }
  await protectLastActiveAdmin(user, user.role, req.body.isActive);
  user.isActive = req.body.isActive;
  user.tokenVersion += 1;
  await user.save();
  return success(res, userView(user), 'User status updated');
}

async function protectLastActiveAdmin(user, nextRole, nextActive) {
  if (user.role === 'admin' && user.isActive && (nextRole !== 'admin' || !nextActive)) {
    const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
    if (activeAdmins <= 1) {
      throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'The last active admin cannot be deactivated or demoted');
    }
  }
}

function validateExtraPermissions(role, permissions) {
  if (!Array.isArray(permissions) || permissions.some((permission) => permission !== 'sales.create')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Only sales.create may be granted as an extra permission');
  }
  if (role !== 'staff' && permissions.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Extra permissions are only supported for staff');
  }
}

function rejectUnknown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { list, create, get, update, updateStatus };
