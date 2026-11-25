const Product = require('../models/Product');
const Category = require('../models/Category');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const StockMovement = require('../models/StockMovement');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { parseListQuery } = require('../utils/pagination');

async function summary(req, res) {
  const period = rangeFor(req.query);
  const [activeProducts, categories, lowStock, outOfStock, recentPurchases, recentSales, movementSummary, salesRevenue, purchaseTotal, estimatedStockValue] =
    await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Category.countDocuments({ isActive: true }),
      Product.find({ status: 'active', stockQty: { $gt: 0 }, $expr: { $lte: ['$stockQty', '$minStockLevel'] } })
        .select('name sku stockQty minStockLevel')
        .sort({ stockQty: 1 })
        .limit(10),
      Product.find({ status: 'active', stockQty: 0 }).select('name sku stockQty minStockLevel').limit(10),
      Purchase.find().sort({ updatedAt: -1 }).limit(5),
      Sale.find().sort({ updatedAt: -1 }).limit(5),
      StockMovement.aggregate([
        { $match: { createdAt: period } },
        { $group: { _id: '$type', count: { $sum: 1 }, quantity: { $sum: { $abs: '$quantity' } } } }
      ]),
      Sale.aggregate([
        { $match: { status: 'confirmed', confirmedAt: period } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Purchase.aggregate([
        { $match: { status: 'received', receivedAt: period } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Product.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: ['$stockQty', { $ifNull: ['$lastPurchaseCost', '$purchasePrice'] }]
              }
            }
          }
        }
      ])
    ]);
  return success(res, {
    counts: { activeProducts, categories },
    lowStock,
    outOfStock,
    recentPurchases,
    recentSales,
    movementSummary,
    salesRevenue: salesRevenue[0]?.total || 0,
    purchaseTotal: purchaseTotal[0]?.total || 0,
    estimatedStockValue: estimatedStockValue[0]?.total || 0
  });
}

async function trends(req, res) {
  const dates = parseRange(req.query);
  const interval = req.query.interval || 'day';
  if (!['day', 'week'].includes(interval)) throw new ApiError(400, 'VALIDATION_ERROR', 'interval must be day or week');
  const groupFormat = interval === 'week' ? '%G-W%V' : '%Y-%m-%d';
  const [sales, purchases] = await Promise.all([
    Sale.aggregate([
      { $match: { status: 'confirmed', confirmedAt: dates } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$confirmedAt', timezone: 'Asia/Kolkata' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Purchase.aggregate([
      { $match: { status: 'received', receivedAt: dates } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$receivedAt', timezone: 'Asia/Kolkata' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);
  return success(res, { interval, sales, purchases });
}

async function stockReport(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query);
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const term = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: term }, { sku: term }];
  }
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').sort(sort).skip(skip).limit(skipCsv(req.query) ? 10000 : limit),
    Product.countDocuments(filter)
  ]);
  const data = products.map((product) => {
    const value = product.stockQty * (product.lastPurchaseCost ?? product.purchasePrice);
    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name,
      unit: product.unit,
      stockQty: product.stockQty,
      minStockLevel: product.minStockLevel,
      stockStatus: product.stockQty === 0 ? 'out' : product.stockQty <= product.minStockLevel ? 'low' : 'ok',
      estimatedValue: Number.isSafeInteger(value) ? value : null
    };
  });
  if (skipCsv(req.query)) return sendCsv(res, data, 'stock-report.csv');
  return paginated(res, data, page, limit, total);
}

async function lowStock(req, res) {
  return stockStatusReport(req, res, {
    status: 'active',
    stockQty: { $gt: 0 },
    $expr: { $lte: ['$stockQty', '$minStockLevel'] }
  }, true);
}

async function outOfStock(req, res) {
  return stockStatusReport(req, res, { status: 'active', stockQty: 0 });
}

async function stockStatusReport(req, res, condition, includeShortfall = false) {
  const { page, limit, skip, sort } = parseListQuery(
    { ...req.query, sort: req.query.sort || 'stockQty' }
  );
  const filter = { ...condition };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const term = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: term }, { sku: term }];
  }
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter)
  ]);
  const data = includeShortfall
    ? products.map((product) => ({
      ...product.toObject(),
      shortfall: product.minStockLevel - product.stockQty
    }))
    : products;
  return paginated(res, data, page, limit, total);
}

async function purchaseReport(req, res) {
  return transactionReport(req, res, Purchase, 'received', 'receivedAt', 'supplier');
}

async function saleReport(req, res) {
  return transactionReport(req, res, Sale, 'confirmed', 'confirmedAt', 'customer');
}

async function transactionReport(req, res, Model, status, dateField, contactField) {
  const { page, limit, skip, sort } = parseListQuery(req.query);
  const filter = { status, [dateField]: parseRange(req.query) };
  if (req.query[contactField]) {
    if (!mongoose.isValidObjectId(req.query[contactField])) {
      throw new ApiError(400, 'VALIDATION_ERROR', `${contactField} must be a valid MongoDB id`);
    }
    filter[contactField] = new mongoose.Types.ObjectId(req.query[contactField]);
  }
  const [data, total, aggregate] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(filter),
    Model.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$total' } } }])
  ]);
  return res.json({
    success: true,
    data,
    meta: { page, total, limit, totalPages: Math.ceil(total / limit), grandTotal: aggregate[0]?.total || 0 }
  });
}

async function movementReport(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query);
  const filter = {};
  if (req.query.from || req.query.to) filter.createdAt = parseRange(req.query);
  if (req.query.product) filter.product = req.query.product;
  if (req.query.type) {
    if (!['OPENING', 'PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(req.query.type)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid movement type');
    }
    filter.type = req.query.type;
  }
  const [data, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('product', 'name sku')
      .populate('performedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter)
  ]);
  return paginated(res, data, page, limit, total);
}

function parseRange(query) {
  if (!query.from && !query.to) throw new ApiError(400, 'VALIDATION_ERROR', 'from or to date is required');
  const range = {};
  if (query.from) range.$gte = parseDate(query.from, false);
  if (query.to) range.$lte = parseDate(query.to, true);
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'from date must not be after to date');
  }
  return range;
}

function rangeFor(query) {
  if (query.from || query.to) return parseRange(query);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const start = parseDate(today, false);
  return { $gte: start };
}

function parseDate(value, end) {
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}+05:30`);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', 'Dates must be ISO 8601 calendar dates');
  return date;
}

function skipCsv(query) {
  if (query.format && query.format !== 'csv') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'format must be csv when provided');
  }
  return query.format === 'csv';
}

function sendCsv(res, rows, filename) {
  const columns = ['sku', 'name', 'category', 'unit', 'stockQty', 'minStockLevel', 'stockStatus', 'estimatedValue'];
  const escape = (value) => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const csv = [columns.join(','), ...rows.map((row) => columns.map((field) => escape(row[field])).join(','))].join('\r\n');
  return res
    .type('text/csv')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .send(csv);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  summary,
  trends,
  stockReport,
  lowStock,
  outOfStock,
  purchaseReport,
  saleReport,
  movementReport
};
