const Counter = require('../models/Counter');
const Setting = require('../models/Setting');

async function next(type, session) {
  const setting = await Setting.findOne({ key: 'app' }).session(session || null).lean();
  const prefix = type === 'PUR' ? setting?.purchasePrefix || 'PUR' : setting?.salePrefix || 'SAL';
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());
  const counterId = `${prefix}-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );
  return `${counterId}-${String(counter.seq).padStart(5, '0')}`;
}

module.exports = { next };
