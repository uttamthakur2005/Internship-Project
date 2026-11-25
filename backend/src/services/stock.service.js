const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');

function assertSafeQuantity(quantity) {
  if (!Number.isSafeInteger(quantity) || quantity === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Stock quantity must be a non-zero integer');
  }
}

async function applyChanges({ changes, type, reference = {}, reason, note, userId, session }) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'At least one stock change is required');
  }
  if (!userId) throw new ApiError(400, 'VALIDATION_ERROR', 'Stock changes require an actor');

  const seen = new Set();
  for (const change of changes) {
    assertSafeQuantity(change.quantity);
    const id = String(change.product);
    if (seen.has(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'A product may appear only once per transaction');
    seen.add(id);
  }

  if (reference.kind && reference.id) {
    const duplicate = await StockMovement.exists({
      'reference.kind': reference.kind,
      'reference.id': reference.id,
      product: { $in: changes.map((change) => change.product) }
    }).session(session || null);
    if (duplicate) throw new ApiError(409, 'DUPLICATE_KEY', 'A movement already exists for this transaction and product');
  }

  if (type === 'OPENING') {
    if (changes.length !== 1 || changes[0].quantity < 1 || !note?.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Opening stock requires a positive quantity and note');
    }
    const existing = await StockMovement.exists({ product: changes[0].product }).session(session || null);
    if (existing) throw new ApiError(409, 'OPENING_STOCK_EXISTS', 'Opening stock can only be recorded once');
  }
  if (type === 'ADJUSTMENT_IN' || type === 'ADJUSTMENT_OUT') {
    if (!reason || (reason === 'OTHER' && !note?.trim())) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Stock adjustments require a reason; OTHER also requires a note');
    }
  }

  const applied = [];
  const movements = [];
  const movementDocuments = [];
  try {
    for (const change of changes) {
      const filter = { _id: change.product, status: 'active' };
      if (change.quantity < 0) filter.stockQty = { $gte: -change.quantity };
      const before = await Product.findById(change.product).session(session || null);
      if (!before || before.status !== 'active') {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Product is unavailable for stock changes');
      }
      if (type === 'OPENING' && before.stockQty !== 0) {
        throw new ApiError(409, 'OPENING_STOCK_EXISTS', 'Opening stock can only be recorded for a product with zero stock');
      }
      const updated = await Product.findOneAndUpdate(
        filter,
        { $inc: { stockQty: change.quantity } },
        { new: true, runValidators: true, session }
      );
      if (!updated) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', `Not enough stock for ${before.sku}`, [
          { field: 'items', message: `Requested ${-change.quantity}, available ${before.stockQty}`, sku: before.sku }
        ]);
      }
      const previousLastPurchaseCost = before.lastPurchaseCost;
      const updatesLastPurchaseCost =
        Number.isSafeInteger(change.unitCost) &&
        (type === 'PURCHASE_IN' || (type === 'OPENING' && before.lastPurchaseCost == null));
      applied.push({
        product: updated._id,
        quantity: change.quantity,
        previousLastPurchaseCost,
        updatesLastPurchaseCost,
        updatedLastPurchaseCost: change.unitCost
      });
      if (!Number.isSafeInteger(updated.stockQty)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Stock quantity exceeds the supported integer range');
      }

      if (updatesLastPurchaseCost) {
        updated.lastPurchaseCost = change.unitCost;
        await updated.save({ session });
      }
      const movement = {
        product: updated._id,
        productSnapshot: { name: updated.name, sku: updated.sku },
        type,
        quantity: change.quantity,
        quantityBefore: updated.stockQty - change.quantity,
        quantityAfter: updated.stockQty,
        performedBy: userId
      };
      if (type === 'OPENING') movement.reason = 'OTHER';
      if (change.unitCost !== undefined) movement.unitCost = change.unitCost;
      if (reference.kind && reference.id) movement.reference = reference;
      if (reason) movement.reason = reason;
      if (note) movement.note = note;
      if (session) {
        const [created] = await StockMovement.create([movement], { session });
        movements.push(created);
      } else {
        movementDocuments.push(movement);
      }
    }
    return session ? movements : StockMovement.insertMany(movementDocuments, { ordered: true });
  } catch (error) {
    if (!session) {
      for (const original of applied.reverse()) {
        try {
          const filter = { _id: original.product };
          if (original.quantity > 0) filter.stockQty = { $gte: original.quantity };
          const reverted = await Product.findOneAndUpdate(
            filter,
            { $inc: { stockQty: -original.quantity } },
            { new: true, runValidators: true }
          );
          if (!reverted) throw new Error(`Could not restore stock for ${original.product}`);
          if (original.updatesLastPurchaseCost) {
            await Product.updateOne(
              { _id: original.product, lastPurchaseCost: original.updatedLastPurchaseCost },
              { $set: { lastPurchaseCost: original.previousLastPurchaseCost } }
            );
          }
        } catch (compensationError) {
          console.error('Stock rollback failed; stock:verify is required', {
            cause: error.message,
            compensation: compensationError.message,
            product: String(original.product)
          });
        }
      }
    }
    throw error;
  }
}

async function openStock({ productId, quantity, unitCost, note, userId, session }) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unitCost) || unitCost < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Opening quantity must be positive and unitCost must be a non-negative integer');
  }
  return applyChanges({
    changes: [{ product: productId, quantity, unitCost }],
    type: 'OPENING',
    note,
    userId,
    session
  });
}

async function adjustStock({ productId, direction, quantity, reason, note, userId, session }) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !['in', 'out'].includes(direction)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Adjustment direction and quantity are invalid');
  }
  return applyChanges({
    changes: [{ product: productId, quantity: direction === 'in' ? quantity : -quantity }],
    type: direction === 'in' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
    reason,
    note,
    userId,
    session
  });
}

module.exports = { applyChanges, openStock, adjustStock };
