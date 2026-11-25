const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true }
    },
    type: {
      type: String,
      enum: ['OPENING', 'PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      validate: [
        { validator: Number.isSafeInteger, message: 'quantity must be an integer' },
        { validator: (quantity) => quantity !== 0, message: 'quantity cannot be zero' }
      ]
    },
    quantityBefore: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    quantityAfter: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    unitCost: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
    reference: {
      kind: { type: String, enum: ['Purchase', 'Sale'], default: null },
      id: { type: mongoose.Schema.Types.ObjectId },
      referenceNo: { type: String }
    },
    reason: {
      type: String,
      enum: ['COUNT_CORRECTION', 'DAMAGED', 'LOST', 'FOUND', 'EXPIRED', 'OTHER'],
      required: function reasonRequired() {
        return ['OPENING', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(this.type);
      }
    },
    note: { type: String, trim: true, maxlength: 500 },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index(
  { 'reference.kind': 1, 'reference.id': 1, product: 1 },
  { unique: true, partialFilterExpression: { 'reference.id': { $exists: true } } }
);
stockMovementSchema.index(
  { product: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'OPENING' } }
);
stockMovementSchema.path('quantityAfter').validate(function quantityReconciles(value) {
  return value === this.quantityBefore + this.quantity;
}, 'quantityAfter must equal quantityBefore plus quantity');
stockMovementSchema.path('quantity').validate(function quantityMatchesType(value) {
  return ['OPENING', 'PURCHASE_IN', 'ADJUSTMENT_IN'].includes(this.type)
    ? value > 0
    : value < 0;
}, 'quantity sign must match movement type');

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete'
]) {
  stockMovementSchema.pre(operation, function rejectMutation() {
    throw new Error('StockMovement records are append-only');
  });
}
stockMovementSchema.pre('bulkWrite', function rejectBulkMutation() {
  throw new Error('StockMovement records are append-only');
});
stockMovementSchema.pre('save', function rejectExistingDocumentMutation() {
  if (!this.isNew) throw new Error('StockMovement records are append-only');
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);
