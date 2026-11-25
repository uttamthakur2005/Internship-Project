const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    description: { type: String, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
module.exports = mongoose.model('Category', categorySchema);
