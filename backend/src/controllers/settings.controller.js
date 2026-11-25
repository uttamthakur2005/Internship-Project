const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/respond');

async function get(req, res) {
  const setting = await Setting.findOneAndUpdate(
    { key: 'app' },
    { $setOnInsert: { key: 'app' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return success(res, setting);
}

async function update(req, res) {
  const allowed = ['companyName', 'currency', 'defaultMinStockLevel', 'purchasePrefix', 'salePrefix'];
  const fields = Object.keys(req.body);
  if (!fields.length || fields.some((field) => !allowed.includes(field))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Only settings fields may be updated');
  }
  const setting = await Setting.findOneAndUpdate(
    { key: 'app' },
    {
      $set: {
        ...Object.fromEntries(fields.map((field) => [field, req.body[field]])),
        updatedBy: req.user._id
      },
      $setOnInsert: { key: 'app' }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return success(res, setting, 'Settings updated');
}

module.exports = { get, update };
