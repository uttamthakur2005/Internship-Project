const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9-]{3,30}$/
    },
    description: { type: String, trim: true, maxlength: 1000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    unit: { type: String, enum: ['pcs', 'box', 'pack', 'kg', 'g', 'l', 'ml', 'm'], required: true },
    purchasePrice: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
    sellingPrice: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
    lastPurchaseCost: {
      type: Number,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: (value) => value == null || Number.isSafeInteger(value),
      default: null
    },
    stockQty: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 0 },
    minStockLevel: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 5 },
    barcode: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, stockQty: 1 });
productSchema.index({ name: 'text', sku: 'text' });
productSchema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }
);
module.exports = mongoose.model('Product', productSchema);
