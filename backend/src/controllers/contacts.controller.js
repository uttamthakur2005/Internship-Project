const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { parseListQuery } = require('../utils/pagination');

function controllerFor(Model, kind) {
  async function list(req, res) {
    const { page, limit, skip, sort } = parseListQuery(req.query, new Set(['name', 'createdAt', 'isActive']));
    const filter = {};
    if (req.query.isActive !== undefined) {
      if (!['true', 'false'].includes(req.query.isActive)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'isActive must be true or false');
      }
      filter.isActive = req.query.isActive === 'true';
    }
    if (kind === 'customer' && req.user.role === 'staff') filter.isActive = true;
    if (req.query.search) filter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
    const [data, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit),
      Model.countDocuments(filter)
    ]);
    return paginated(res, data, page, limit, total);
  }

  async function create(req, res) {
    const body = validatedBody(req.body, kind);
    const record = await Model.create({ ...body, createdBy: req.user._id });
    return success(res, record, `${kind} created`, 201);
  }

  async function get(req, res) {
    const record = await Model.findById(req.params.id);
    if (!record) throw new ApiError(404, 'NOT_FOUND', `${kind} not found`);
    return success(res, record);
  }

  async function update(req, res) {
    const body = validatedBody(req.body, kind, true);
    const record = await Model.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!record) throw new ApiError(404, 'NOT_FOUND', `${kind} not found`);
    return success(res, record, `${kind} updated`);
  }

  async function history(req, res) {
    const contact = await Model.findById(req.params.id).select('_id');
    if (!contact) throw new ApiError(404, 'NOT_FOUND', `${kind} not found`);
    const { page, limit, skip } = parseListQuery(req.query, new Set(['createdAt', kind === 'supplier' ? 'purchaseDate' : 'saleDate']));
    const filter = kind === 'supplier' ? { supplier: req.params.id } : { customer: req.params.id };
    if (kind === 'sale' && req.user.role === 'staff') filter.createdBy = req.user._id;
    const ModelForHistory = kind === 'supplier' ? Purchase : Sale;
    const [data, total] = await Promise.all([
      ModelForHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ModelForHistory.countDocuments(filter)
    ]);
    return paginated(res, data, page, limit, total);
  }

  return { list, create, get, update, history };
}

function validatedBody(body, kind, partial = false) {
  const allowed = kind === 'supplier'
    ? ['name', 'contactPerson', 'phone', 'email', 'address', 'isActive']
    : ['name', 'phone', 'email', 'address', 'isActive'];
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'isActive must be a boolean');
  }
  if (!partial && kind === 'supplier' && (!body.name || !body.phone)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Supplier name and phone are required');
  }
  if (!partial && kind === 'customer' && !body.name) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Customer name is required');
  }
  return body;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  suppliers: controllerFor(Supplier, 'supplier'),
  customers: controllerFor(Customer, 'customer')
};
