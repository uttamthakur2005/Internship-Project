const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/respond');
const { effectivePermissions } = require('../config/permissions');

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    permissions: effectivePermissions(user)
  };
}

async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = user && (await bcrypt.compare(String(req.body.password || ''), user.passwordHash));
  if (!matches || !user.isActive) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign(
    { sub: String(user._id), tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  return success(
    res,
    { token, expiresIn: process.env.JWT_EXPIRES_IN || '8h', user: publicUser(user) },
    undefined,
    200
  );
}

function me(req, res) {
  return success(res, { user: publicUser(req.authUser), permissions: req.user.permissions });
}

async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  return success(res, null, 'Logged out');
}

async function updateMe(req, res) {
  rejectUnknown(req.body, ['name', 'phone']);
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.phone !== undefined) updates.phone = req.body.phone;
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
  return success(res, publicUser(user), 'Profile updated');
}

async function changePassword(req, res) {
  rejectUnknown(req.body, ['currentPassword', 'newPassword']);
  const user = await User.findById(req.user._id).select('+passwordHash');
  const matches = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
  if (!matches) throw new ApiError(400, 'VALIDATION_ERROR', 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.tokenVersion += 1;
  await user.save();
  return success(res, null, 'Password updated; please log in again');
}

function rejectUnknown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
}

module.exports = { login, me, logout, updateMe, changePassword, publicUser };
