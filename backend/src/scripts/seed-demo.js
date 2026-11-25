require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Counter = require('../models/Counter');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const StockMovement = require('../models/StockMovement');
const { connectDatabase } = require('../config/database');
const stockService = require('../services/stock.service');
const transactionService = require('../services/transaction.service');

const categoryNames = [
  'Stationery',
  'Electronics',
  'Office Supplies',
  'Cleaning',
  'Packaging',
  'Furniture',
  'Tools',
  'Accessories'
];

async function seedDemo() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set SEED_DEMO_PASSWORD to a password with at least 8 characters');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:demo is disabled in production');
  }

  await connectDatabase();
  try {
    const models = [User, Setting, Counter, Category, Product, Supplier, Customer, Purchase, Sale, StockMovement];
    const counts = await Promise.all(models.map((Model) => Model.countDocuments()));
    if (counts.some((count) => count > 0)) {
      throw new Error('seed:demo requires an empty database; refusing to mix demo records with existing data');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [admin, manager, staff] = await User.create([
      {
        name: 'Demo Admin',
        email: 'admin@demo.local',
        passwordHash,
        role: 'admin'
      },
      {
        name: 'Demo Manager',
        email: 'manager@demo.local',
        passwordHash,
        role: 'manager'
      },
      {
        name: 'Demo Staff',
        email: 'staff@demo.local',
        passwordHash,
        role: 'staff',
        extraPermissions: ['sales.create']
      }
    ]);

    manager.createdBy = admin._id;
    staff.createdBy = admin._id;
    await Promise.all([manager.save(), staff.save()]);

    await Setting.create({ key: 'app', updatedBy: admin._id });
    const categories = await Category.create(
      categoryNames.map((name) => ({ name, createdBy: admin._id }))
    );
    const suppliers = await Supplier.create(
      Array.from({ length: 5 }, (_, index) => ({
        name: `Demo Supplier ${String(index + 1).padStart(2, '0')}`,
        contactPerson: `Contact ${index + 1}`,
        phone: `900000${String(index + 1).padStart(4, '0')}`,
        email: `supplier${index + 1}@demo.local`,
        createdBy: admin._id
      }))
    );
    const customers = await Customer.create(
      Array.from({ length: 10 }, (_, index) => ({
        name: `Demo Customer ${String(index + 1).padStart(2, '0')}`,
        phone: `910000${String(index + 1).padStart(4, '0')}`,
        email: `customer${index + 1}@demo.local`,
        createdBy: admin._id
      }))
    );
    const products = await Product.create(
      Array.from({ length: 40 }, (_, index) => ({
        name: `Demo Product ${String(index + 1).padStart(2, '0')}`,
        sku: `DEMO-${String(index + 1).padStart(4, '0')}`,
        category: categories[index % categories.length]._id,
        unit: ['pcs', 'box', 'pack', 'kg'][index % 4],
        purchasePrice: 100 + index * 25,
        sellingPrice: 150 + index * 35,
        minStockLevel: 5 + (index % 6),
        createdBy: admin._id
      }))
    );

    for (const [index, product] of products.entries()) {
      await transactionService.withStockSession((session) =>
        stockService.openStock({
          productId: product._id,
          quantity: 20 + (index % 8),
          unitCost: product.purchasePrice,
          note: 'Demo opening stock',
          userId: admin._id,
          session
        })
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const purchase = await transactionService.createPurchase(
      {
        supplier: suppliers[0]._id,
        purchaseDate: date,
        items: products.slice(0, 5).map((product) => ({
          product: product._id,
          quantity: 10,
          unitCost: product.purchasePrice
        })),
        notes: 'Demo received purchase'
      },
      manager
    );
    await transactionService.orderPurchase(purchase._id, manager);
    await transactionService.receivePurchase(purchase._id, manager);

    const sale = await transactionService.createSale(
      {
        customer: customers[0]._id,
        saleDate: date,
        items: products.slice(0, 5).map((product) => ({
          product: product._id,
          quantity: 2
        }))
      },
      manager
    );
    await transactionService.confirmSale(sale._id, manager);

    console.log('Demo dataset created: 3 users, 8 categories, 40 products, 5 suppliers, 10 customers, 1 received purchase, and 1 confirmed sale.');
    console.log('Demo account emails: admin@demo.local, manager@demo.local, staff@demo.local');
    console.log('All demo accounts use the password supplied in SEED_DEMO_PASSWORD.');
  } finally {
    await mongoose.disconnect();
  }
}

seedDemo().catch((error) => {
  console.error('Unable to seed demo data:', error.message);
  process.exitCode = 1;
});
