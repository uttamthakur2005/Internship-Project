const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['app'], default: 'app', unique: true },
    companyName: { type: String, trim: true, maxlength: 100, default: 'Inventory Management System' },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    defaultMinStockLevel: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, default: 5 },
    purchasePrefix: { type: String, trim: true, default: 'PUR', match: /^[A-Z0-9-]{1,10}$/ },
    salePrefix: { type: String, trim: true, default: 'SAL', match: /^[A-Z0-9-]{1,10}$/ },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
