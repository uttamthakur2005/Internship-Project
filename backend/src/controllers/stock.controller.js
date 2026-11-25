const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { parseListQuery } = require('../utils/pagination');
const stockService = require('../services/stock.service');
const { withStockSession } = require('../services/transaction.service');

const MOVEMENT_TYPES = ['OPENING', 'PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'];
const ADJUSTMENT_REASONS = ['COUNT_CORRECTION', 'DAMAGED', 'LOST', 'FOUND', 'EXPIRED', 'OTHER'];

async function opening(req, res) {
  rejectUnknown(req.body, ['productId', 'quantity', 'unitCost', 'note']);
  const data = await withStockSession((session) =>
    stockService.openStock({
      productId: req.body.productId,
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      note: req.body.note,
      userId: req.user._id,
      session
    })
  );
  return success(res, data[0], 'Opening stock recorded', 201);
}

async function adjustment(req, res) {
  rejectUnknown(req.body, ['productId', 'direction', 'quantity', 'reason', 'note']);
  if (!ADJUSTMENT_REASONS.includes(req.body.reason)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid stock adjustment reason');
  }
  const data = await withStockSession((session) =>
    stockService.adjustStock({
      productId: req.body.productId,
      direction: req.body.direction,
      quantity: req.body.quantity,
      reason: req.body.reason,
      note: req.body.note,
      userId: req.user._id,
      session
    })
  );
  return success(res, data[0], 'Stock adjusted', 201);
}

async function movements(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query);
  const filter = {};
  if (req.query.product) filter.product = req.query.product;
  if (req.query.type) {
    if (!MOVEMENT_TYPES.includes(req.query.type)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid movement type');
    filter.type = req.query.type;
  }
  if (req.query.from || req.query.to) {
    const range = {};
    if (req.query.from) range.$gte = parseDate(req.query.from, false);
    if (req.query.to) range.$lte = parseDate(req.query.to, true);
    filter.createdAt = range;
  }
  const [data, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('performedBy', 'name role')
      .populate('product', 'name sku')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter)
  ]);
  return paginated(res, data, page, limit, total);
}

function parseDate(value, end) {
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}+05:30`);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date filter');
  return date;
}

function rejectUnknown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
}

module.exports = { opening, adjustment, movements };
