const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    unitCost: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    lineTotal: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true }
    },
    items: { type: [purchaseItemSchema], required: true, validate: [(items) => items.length > 0, 'At least one item is required'] },
    total: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    status: { type: String, enum: ['draft', 'ordered', 'received', 'cancelled'], default: 'draft' },
    purchaseDate: { type: Date, required: true },
    receivedAt: Date,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseSchema.index({ status: 1, purchaseDate: 1 });
purchaseSchema.index({ supplier: 1, purchaseDate: 1 });
purchaseSchema.index({ receivedAt: 1 });
module.exports = mongoose.model('Purchase', purchaseSchema);
