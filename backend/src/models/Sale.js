const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    unitPrice: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    lineTotal: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, default: '' }
    },
    items: { type: [saleItemSchema], required: true, validate: [(items) => items.length > 0, 'At least one item is required'] },
    total: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    status: { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'draft' },
    saleDate: { type: Date, required: true },
    confirmedAt: Date,
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

saleSchema.index({ status: 1, confirmedAt: 1 });
saleSchema.index({ customer: 1, saleDate: 1 });
saleSchema.index({ createdBy: 1 });
module.exports = mongoose.model('Sale', saleSchema);
