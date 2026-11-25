const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');
const referenceService = require('./reference.service');
const stockService = require('./stock.service');

const transactionsEnabled = () => process.env.TRANSACTIONS_ENABLED !== 'false';

async function withStockSession(work) {
  if (!transactionsEnabled()) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function validateUniqueItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'At least one item is required');
  }
  const productIds = items.map((item) => String(item.product));
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A product may appear only once per transaction');
  }
}

async function snapshotItems(items, kind, session) {
  validateUniqueItems(items);
  const result = [];
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.product)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid product id');
    }
    const product = await Product.findOne({ _id: item.product, status: 'active' }).session(session || null);
    if (!product) throw new ApiError(400, 'VALIDATION_ERROR', `Product ${item.product} is unavailable`);
    const quantity = Number(item.quantity);
    const unitPrice = kind === 'purchase' ? Number(item.unitCost) : Number(item.unitPrice ?? product.sellingPrice);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Line quantity and unit price must be valid non-negative integers');
    }
    const lineTotal = quantity * unitPrice;
    if (!Number.isSafeInteger(lineTotal)) throw new ApiError(400, 'VALIDATION_ERROR', 'Line total exceeds the supported range');
    result.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity,
      ...(kind === 'purchase' ? { unitCost: unitPrice } : { unitPrice }),
      lineTotal
    });
  }
  return result;
}

function totalFor(items) {
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(total)) throw new ApiError(400, 'VALIDATION_ERROR', 'Transaction total exceeds the supported range');
  return total;
}

async function createPurchase(input, user) {
  const supplier = await Supplier.findOne({ _id: input.supplier, isActive: true });
  if (!supplier) throw new ApiError(400, 'VALIDATION_ERROR', 'An active supplier is required');
  const items = await snapshotItems(input.items, 'purchase');
  const referenceNo = await referenceService.next('PUR');
  return Purchase.create({
    referenceNo,
    supplier: supplier._id,
    supplierSnapshot: { name: supplier.name, phone: supplier.phone },
    items,
    total: totalFor(items),
    purchaseDate: input.purchaseDate,
    notes: input.notes,
    createdBy: user._id,
    updatedBy: user._id
  });
}

async function updatePurchase(purchaseId, input, user) {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new ApiError(404, 'NOT_FOUND', 'Purchase not found');
  if (purchase.status !== 'draft') throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Only draft purchases can be edited');
  if (input.supplier) {
    const supplier = await Supplier.findOne({ _id: input.supplier, isActive: true });
    if (!supplier) throw new ApiError(400, 'VALIDATION_ERROR', 'An active supplier is required');
    purchase.supplier = supplier._id;
    purchase.supplierSnapshot = { name: supplier.name, phone: supplier.phone };
  }
  if (input.items) {
    purchase.items = await snapshotItems(input.items, 'purchase');
    purchase.total = totalFor(purchase.items);
  }
  if (input.purchaseDate) purchase.purchaseDate = input.purchaseDate;
  if (input.notes !== undefined) purchase.notes = input.notes;
  purchase.updatedBy = user._id;
  await purchase.save();
  return purchase;
}

async function transitionError(Model, id, scope = {}) {
  const existing = await Model.findOne({ _id: id, ...scope }).select('status');
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Record not found');
  throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Invalid status transition from ${existing.status}`);
}

async function orderPurchase(id, user) {
  const updated = await Purchase.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { $set: { status: 'ordered', updatedBy: user._id } },
    { new: true, runValidators: true }
  );
  if (!updated) return transitionError(Purchase, id);
  return updated;
}

async function cancelPurchase(id, reason, user) {
  const updated = await Purchase.findOneAndUpdate(
    { _id: id, status: { $in: ['draft', 'ordered'] } },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user._id,
        cancelReason: reason,
        updatedBy: user._id
      }
    },
    { new: true, runValidators: true }
  );
  if (!updated) return transitionError(Purchase, id);
  return updated;
}

async function receivePurchase(id, user) {
  return withStockSession(async (session) => {
    const now = new Date();
    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, status: 'ordered' },
      { $set: { status: 'received', receivedAt: now, receivedBy: user._id, updatedBy: user._id } },
      { new: true, session, runValidators: true }
    );
    if (!purchase) return transitionError(Purchase, id);
    try {
      const movements = await stockService.applyChanges({
        changes: purchase.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          unitCost: item.unitCost
        })),
        type: 'PURCHASE_IN',
        reference: { kind: 'Purchase', id: purchase._id, referenceNo: purchase.referenceNo },
        userId: user._id,
        session
      });
      return { purchase, movements };
    } catch (error) {
      if (!session) {
        await Purchase.updateOne(
          { _id: purchase._id, status: 'received' },
          { $set: { status: 'ordered' }, $unset: { receivedAt: 1, receivedBy: 1 } }
        );
        console.error('Purchase receipt failed with transactions disabled; stock rollback was attempted', {
          purchase: purchase.referenceNo,
          error: error.message
        });
      }
      throw error;
    }
  });
}

async function createSale(input, user) {
  let customer = null;
  if (input.customer) {
    customer = await Customer.findOne({ _id: input.customer, isActive: true });
    if (!customer) throw new ApiError(400, 'VALIDATION_ERROR', 'Customer is unavailable');
  }
  const items = await snapshotItems(input.items, 'sale');
  const referenceNo = await referenceService.next('SAL');
  return Sale.create({
    referenceNo,
    customer: customer?._id || null,
    customerSnapshot: customer
      ? { name: customer.name, phone: customer.phone || '' }
      : { name: 'Walk-in customer', phone: '' },
    items,
    total: totalFor(items),
    saleDate: input.saleDate,
    createdBy: user._id,
    updatedBy: user._id
  });
}

async function updateSale(id, input, user) {
  const sale = await Sale.findById(id);
  if (!sale) throw new ApiError(404, 'NOT_FOUND', 'Sale not found');
  if (sale.status !== 'draft') throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Only draft sales can be edited');
  if (user.role === 'staff' && String(sale.createdBy) !== String(user._id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Sale not found');
  }
  if (Object.hasOwn(input, 'customer')) {
    const customer = input.customer
      ? await Customer.findOne({ _id: input.customer, isActive: true })
      : null;
    if (input.customer && !customer) throw new ApiError(400, 'VALIDATION_ERROR', 'Customer is unavailable');
    sale.customer = customer?._id || null;
    sale.customerSnapshot = customer
      ? { name: customer.name, phone: customer.phone || '' }
      : { name: 'Walk-in customer', phone: '' };
  }
  if (input.items) {
    sale.items = await snapshotItems(input.items, 'sale');
    sale.total = totalFor(sale.items);
  }
  if (input.saleDate) sale.saleDate = input.saleDate;
  sale.updatedBy = user._id;
  await sale.save();
  return sale;
}

async function confirmSale(id, user) {
  return withStockSession(async (session) => {
    const scope = user.role === 'staff' ? { createdBy: user._id } : {};
    const sale = await Sale.findOneAndUpdate(
      { _id: id, status: 'draft', ...scope },
      { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: user._id, updatedBy: user._id } },
      { new: true, session, runValidators: true }
    );
    if (!sale) return transitionError(Sale, id, scope);
    try {
      const movements = await stockService.applyChanges({
        changes: sale.items.map((item) => ({ product: item.product, quantity: -item.quantity })),
        type: 'SALE_OUT',
        reference: { kind: 'Sale', id: sale._id, referenceNo: sale.referenceNo },
        userId: user._id,
        session
      });
      return { sale, movements };
    } catch (error) {
      if (!session) {
        await Sale.updateOne(
          { _id: sale._id, status: 'confirmed' },
          { $set: { status: 'draft' }, $unset: { confirmedAt: 1, confirmedBy: 1 } }
        );
        console.error('Sale confirmation failed with transactions disabled; stock rollback was attempted', {
          sale: sale.referenceNo,
          error: error.message
        });
      }
      throw error;
    }
  });
}

async function cancelSale(id, reason, user) {
  const ownership = user.role === 'staff' ? { createdBy: user._id } : {};
  const canCancelAny = user.permissions.includes('sales.cancel');
  const scope = canCancelAny ? {} : ownership;
  const updated = await Sale.findOneAndUpdate(
    { _id: id, status: 'draft', ...scope },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user._id,
        cancelReason: reason,
        updatedBy: user._id
      }
    },
    { new: true, runValidators: true }
  );
  if (!updated) return transitionError(Sale, id, scope);
  return updated;
}

async function listTransactions(Model, query, user, kind) {
  const filter = {};
  if (query.status) {
    const statuses = kind === 'purchase'
      ? ['draft', 'ordered', 'received', 'cancelled']
      : ['draft', 'confirmed', 'cancelled'];
    if (!statuses.includes(query.status)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transaction status');
    filter.status = query.status;
  }
  if (query.from || query.to) {
    const field = kind === 'purchase' ? 'purchaseDate' : 'saleDate';
    const from = query.from ? new Date(`${query.from}T00:00:00+05:30`) : null;
    const to = query.to ? new Date(`${query.to}T23:59:59.999+05:30`) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date range');
    }
    filter[field] = {};
    if (from) filter[field].$gte = from;
    if (to) filter[field].$lte = to;
    if (from && to && from > to) throw new ApiError(400, 'VALIDATION_ERROR', 'from date must not be after to date');
  }
  if (query.supplier && kind === 'purchase') filter.supplier = query.supplier;
  if (query.customer && kind === 'sale') filter.customer = query.customer;
  if (kind === 'sale' && user.role === 'staff') filter.createdBy = user._id;
  if (query.search) filter.referenceNo = { $regex: escapeRegex(query.search), $options: 'i' };
  const { parseListQuery } = require('../utils/pagination');
  const { page, limit, skip, sort } = parseListQuery(query);
  const [data, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(filter)
  ]);
  return { data, page, limit, total };
}

async function getTransaction(Model, id, user, kind) {
  const filter = { _id: id };
  if (kind === 'sale' && user.role === 'staff') filter.createdBy = user._id;
  const document = await Model.findOne(filter);
  if (!document) throw new ApiError(404, 'NOT_FOUND', 'Record not found');
  return document;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  createPurchase,
  updatePurchase,
  orderPurchase,
  receivePurchase,
  cancelPurchase,
  createSale,
  updateSale,
  confirmSale,
  cancelSale,
  listTransactions,
  getTransaction,
  withStockSession
};
