const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 2, maxlength: 60, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'manager', 'staff'], required: true },
    extraPermissions: {
      type: [{ type: String, enum: ['sales.create'] }],
      default: []
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0, min: 0 },
    lastLoginAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isActive: 1 });
module.exports = mongoose.model('User', userSchema);
