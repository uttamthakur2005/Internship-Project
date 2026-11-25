require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { connectDatabase } = require('../config/database');

async function verifyStock() {
  await connectDatabase();
  try {
    const [products, movementTotals, orphaned] = await Promise.all([
      Product.find().select('_id sku stockQty').lean(),
      StockMovement.aggregate([
        { $group: { _id: '$product', movementTotal: { $sum: '$quantity' } } }
      ]),
      StockMovement.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productRecord'
          }
        },
        { $match: { productRecord: { $size: 0 } } },
        { $project: { _id: 1, product: 1 } }
      ])
    ]);
    const totals = new Map(movementTotals.map((item) => [String(item._id), item.movementTotal]));
    const mismatches = products
      .filter((product) => product.stockQty !== (totals.get(String(product._id)) || 0))
      .map((product) => ({
        sku: product.sku,
        stockQty: product.stockQty,
        movementTotal: totals.get(String(product._id)) || 0
      }));

    if (mismatches.length || orphaned.length) {
      console.error(JSON.stringify({ mismatches, orphaned }, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(`Stock verified: ${products.length} products reconcile with movement history.`);
  } finally {
    await mongoose.disconnect();
  }
}

verifyStock().catch((error) => {
  console.error('Unable to verify stock:', error.message);
  process.exitCode = 1;
});
