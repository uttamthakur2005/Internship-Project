const Category = require('../models/Category');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { parseListQuery } = require('../utils/pagination');

async function listCategories(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query, new Set(['name', 'createdAt']));
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = parseBoolean(req.query.isActive);
  if (req.user.role === 'staff') filter.isActive = true;
  if (req.query.search) filter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
  const [data, total] = await Promise.all([
    Category.find(filter).collation({ locale: 'en', strength: 2 }).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter)
  ]);
  return paginated(res, data, page, limit, total);
}

async function createCategory(req, res) {
  rejectUnknown(req.body, ['name', 'description']);
  const category = await Category.create({ ...req.body, createdBy: req.user._id });
  return success(res, category, 'Category created', 201);
}

async function updateCategory(req, res) {
  const fields = {};
  for (const key of ['name', 'description', 'isActive']) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  rejectUnknown(req.body, ['name', 'description', 'isActive']);
  const category = await Category.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, 'NOT_FOUND', 'Category not found');
  return success(res, category, 'Category updated');
}

async function listProducts(req, res) {
  const { page, limit, skip, sort } = parseListQuery(req.query);
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) {
    if (!['active', 'inactive'].includes(req.query.status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'status must be active or inactive');
    }
    filter.status = req.query.status;
  }
  if (req.user.role === 'staff') filter.status = 'active';
  if (req.query.search) filter.$text = { $search: req.query.search };
  if (req.query.stockStatus === 'low') {
    filter.status = 'active';
    filter.stockQty = { $gt: 0 };
    filter.$expr = { $lte: ['$stockQty', '$minStockLevel'] };
  } else if (req.query.stockStatus === 'out') {
    filter.status = 'active';
    filter.stockQty = 0;
  } else if (req.query.stockStatus === 'ok') {
    filter.status = 'active';
    filter.$expr = { $gt: ['$stockQty', '$minStockLevel'] };
  } else if (req.query.stockStatus !== undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'stockStatus must be low, out, or ok');
  }
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter)
  ]);
  return paginated(res, products.map(withStockStatus), page, limit, total);
}

async function createProduct(req, res) {
  rejectUnknown(req.body, [
    'name', 'sku', 'description', 'category', 'unit', 'purchasePrice',
    'sellingPrice', 'minStockLevel', 'barcode'
  ]);
  if (Object.hasOwn(req.body, 'stockQty') || Object.hasOwn(req.body, 'lastPurchaseCost')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'stockQty and lastPurchaseCost are server-controlled');
  }
  const category = await Category.findOne({ _id: req.body.category, isActive: true });
  if (!category) throw new ApiError(400, 'VALIDATION_ERROR', 'An active category is required');
  const setting = await Setting.findOne({ key: 'app' });
  const product = await Product.create({
    ...req.body,
    sku: String(req.body.sku || '').toUpperCase(),
    barcode: req.body.barcode || undefined,
    minStockLevel: req.body.minStockLevel ?? setting?.defaultMinStockLevel ?? 5,
    stockQty: 0,
    createdBy: req.user._id
  });
  return success(res, withStockStatus(product), 'Product created', 201);
}

async function getProduct(req, res) {
  const filter = { _id: req.params.id };
  if (req.user.role === 'staff') filter.status = 'active';
  const product = await Product.findOne(filter).populate('category', 'name');
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  return success(res, withStockStatus(product));
}

async function updateProduct(req, res) {
  rejectUnknown(req.body, [
    'name', 'sku', 'description', 'category', 'unit', 'purchasePrice',
    'sellingPrice', 'minStockLevel', 'barcode'
  ]);
  if (Object.hasOwn(req.body, 'stockQty') || Object.hasOwn(req.body, 'lastPurchaseCost')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'stockQty and lastPurchaseCost are server-controlled');
  }
  if (req.body.category) {
    const category = await Category.findOne({ _id: req.body.category, isActive: true });
    if (!category) throw new ApiError(400, 'VALIDATION_ERROR', 'An active category is required');
  }
  const updates = { ...req.body, updatedBy: req.user._id };
  if (updates.sku) updates.sku = updates.sku.toUpperCase();
  if (updates.barcode === '') updates.barcode = null;
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
    .populate('category', 'name');
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  return success(res, withStockStatus(product), 'Product updated');
}

async function updateProductStatus(req, res) {
  rejectUnknown(req.body, ['status']);
  if (!['active', 'inactive'].includes(req.body.status)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'status must be active or inactive');
  }
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { status: req.body.status, updatedBy: req.user._id } },
    { new: true, runValidators: true }
  );
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  return success(res, withStockStatus(product), 'Product status updated');
}

function withStockStatus(product) {
  const record = product.toObject ? product.toObject() : product;
  const status =
    record.stockQty === 0 ? 'out' :
      record.stockQty <= record.minStockLevel ? 'low' : 'ok';
  return { ...record, stockStatus: status };
}

function parseBoolean(value) {
  if (!['true', 'false'].includes(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'isActive must be true or false');
  return value === 'true';
}

function rejectUnknown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  updateProductStatus,
  withStockStatus
};
