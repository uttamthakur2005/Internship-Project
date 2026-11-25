const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');

const mongoUri = process.env.MONGODB_URI_TEST;

test(
  'MongoDB-backed auth, permissions, and stock lifecycle',
  { skip: !mongoUri },
  async () => {
    const parsedUri = new URL(mongoUri);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUri.hostname)) {
      throw new Error('MONGODB_URI_TEST must point to a local, disposable MongoDB test instance');
    }

    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-local-checks-12345';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.TRANSACTIONS_ENABLED ||= 'true';
    const databaseName = `ims_e2e_${process.pid}_${Date.now()}`;
    parsedUri.pathname = `/${databaseName}`;
    const app = require('../src/app');

    try {
      await mongoose.connect(parsedUri.toString());
      await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
      const User = require('../src/models/User');
      const Product = require('../src/models/Product');
      const StockMovement = require('../src/models/StockMovement');
      const password = 'test-password-123';
      const passwordHash = await bcrypt.hash(password, 4);
      const admin = await User.create({
        name: 'Test Admin',
        email: 'admin@test.local',
        passwordHash,
        role: 'admin'
      });
      const api = request(app);
      const login = await api.post('/api/auth/login').send({ email: admin.email, password });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      const adminAuth = { Authorization: `Bearer ${login.body.data.token}` };

      const categoryResponse = await api.post('/api/categories').set(adminAuth).send({ name: 'E2E Stationery' });
      assert.equal(categoryResponse.status, 201, JSON.stringify(categoryResponse.body));
      const categoryId = categoryResponse.body.data._id;
      const productResponse = await api.post('/api/products').set(adminAuth).send({
        name: 'E2E Pen',
        sku: 'E2E-PEN-01',
        category: categoryId,
        unit: 'pcs',
        purchasePrice: 580,
        sellingPrice: 1000,
        minStockLevel: 3
      });
      assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));
      const productId = productResponse.body.data._id;
      assert.equal(productResponse.body.data.stockQty, 0);

      const opening = await api.post('/api/stock/opening').set(adminAuth).send({
        productId,
        quantity: 5,
        unitCost: 580,
        note: 'Opening e2e'
      });
      assert.equal(opening.status, 201, JSON.stringify(opening.body));
      assert.equal(
        (await api.post('/api/stock/opening').set(adminAuth).send({
          productId,
          quantity: 1,
          unitCost: 1,
          note: 'Repeated opening'
        })).status,
        409
      );

      const supplier = await api.post('/api/suppliers').set(adminAuth).send({
        name: 'E2E Supplier',
        phone: '9876543210'
      });
      assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
      const purchase = await api.post('/api/purchases').set(adminAuth).send({
        supplier: supplier.body.data._id,
        purchaseDate: '2026-11-02',
        items: [{ product: productId, quantity: 4, unitCost: 600 }]
      });
      assert.equal(purchase.status, 201, JSON.stringify(purchase.body));
      const purchaseId = purchase.body.data._id;
      assert.equal((await api.post(`/api/purchases/${purchaseId}/receive`).set(adminAuth)).status, 409);
      assert.equal((await Product.findById(productId)).stockQty, 5);
      assert.equal((await api.post(`/api/purchases/${purchaseId}/order`).set(adminAuth)).status, 200);
      assert.equal((await api.post(`/api/purchases/${purchaseId}/receive`).set(adminAuth)).status, 200);
      assert.equal((await Product.findById(productId)).stockQty, 9);
      assert.equal((await api.post(`/api/purchases/${purchaseId}/receive`).set(adminAuth)).status, 409);
      assert.equal((await Product.findById(productId)).stockQty, 9);

      const sale = await api.post('/api/sales').set(adminAuth).send({
        saleDate: '2026-11-02',
        items: [{ product: productId, quantity: 10, unitPrice: 1000 }]
      });
      assert.equal(sale.status, 201, JSON.stringify(sale.body));
      const saleId = sale.body.data._id;
      const insufficient = await api.post(`/api/sales/${saleId}/confirm`).set(adminAuth);
      assert.equal(insufficient.status, 409);
      assert.equal(insufficient.body.error.code, 'INSUFFICIENT_STOCK');
      assert.equal((await Product.findById(productId)).stockQty, 9);
      assert.equal(
        (await api.patch(`/api/sales/${saleId}`).set(adminAuth).send({
          items: [{ product: productId, quantity: 8, unitPrice: 1000 }]
        })).status,
        200
      );
      assert.equal((await api.post(`/api/sales/${saleId}/confirm`).set(adminAuth)).status, 200);
      assert.equal((await Product.findById(productId)).stockQty, 1);
      assert.equal((await api.post(`/api/sales/${saleId}/confirm`).set(adminAuth)).status, 409);
      assert.equal((await Product.findById(productId)).stockQty, 1);

      const adjustment = await api.post('/api/stock/adjustments').set(adminAuth).send({
        productId,
        direction: 'in',
        quantity: 2,
        reason: 'FOUND'
      });
      assert.equal(adjustment.status, 201, JSON.stringify(adjustment.body));
      assert.equal((await Product.findById(productId)).stockQty, 3);

      const emptyProductResponse = await api.post('/api/products').set(adminAuth).send({
        name: 'Zero stock E2E Product',
        sku: 'E2E-ZERO-01',
        category: categoryId,
        unit: 'pcs',
        purchasePrice: 100,
        sellingPrice: 200
      });
      assert.equal(emptyProductResponse.status, 201, JSON.stringify(emptyProductResponse.body));
      const partialSale = await api.post('/api/sales').set(adminAuth).send({
        saleDate: '2026-11-02',
        items: [
          { product: productId, quantity: 1, unitPrice: 1000 },
          { product: emptyProductResponse.body.data._id, quantity: 1, unitPrice: 200 }
        ]
      });
      assert.equal(partialSale.status, 201, JSON.stringify(partialSale.body));
      const partialFailure = await api.post(`/api/sales/${partialSale.body.data._id}/confirm`).set(adminAuth);
      assert.equal(partialFailure.status, 409);
      assert.equal(partialFailure.body.error.code, 'INSUFFICIENT_STOCK');
      assert.equal((await Product.findById(productId)).stockQty, 3);
      assert.equal((await Product.findById(emptyProductResponse.body.data._id)).stockQty, 0);
      assert.equal(
        (await api.post('/api/stock/opening').set(adminAuth).send({
          productId: emptyProductResponse.body.data._id,
          quantity: 1,
          unitCost: 100,
          note: 'Stock to retry the previously failed sale'
        })).status,
        201
      );
      assert.equal((await api.post(`/api/sales/${partialSale.body.data._id}/confirm`).set(adminAuth)).status, 200);
      assert.equal((await Product.findById(productId)).stockQty, 2);
      assert.equal((await Product.findById(emptyProductResponse.body.data._id)).stockQty, 0);

      const inactiveProduct = await api.post('/api/products').set(adminAuth).send({
        name: 'Inactive E2E Product',
        sku: 'E2E-INACTIVE-01',
        category: categoryId,
        unit: 'pcs',
        purchasePrice: 100,
        sellingPrice: 200
      });
      assert.equal(inactiveProduct.status, 201, JSON.stringify(inactiveProduct.body));
      assert.equal(
        (await api.patch(`/api/products/${inactiveProduct.body.data._id}/status`).set(adminAuth).send({ status: 'inactive' })).status,
        200
      );

      const staff = await User.create({
        name: 'Test Staff',
        email: 'staff@test.local',
        passwordHash,
        role: 'staff'
      });
      const staffLogin = await api.post('/api/auth/login').send({ email: staff.email, password });
      assert.equal(staffLogin.status, 200);
      const staffAuth = { Authorization: `Bearer ${staffLogin.body.data.token}` };
      assert.equal(
        (await api.post('/api/products').set(staffAuth).send({ name: 'No', sku: 'NO-1' })).status,
        403
      );
      const staffProducts = await api.get('/api/products').set(staffAuth);
      assert.equal(staffProducts.status, 200);
      assert.ok(staffProducts.body.data.every((item) => item.status === 'active'));
      assert.equal((await api.get('/api/sales').set(staffAuth)).body.data.length, 0);

      assert.equal(
        (await api.patch(`/api/users/${staff._id}`).set(adminAuth).send({ extraPermissions: ['sales.create'] })).status,
        200
      );
      const staffSale = await api.post('/api/sales').set(staffAuth).send({
        saleDate: '2026-11-02',
        items: [{ product: productId, quantity: 1 }]
      });
      assert.equal(staffSale.status, 201, JSON.stringify(staffSale.body));
      assert.equal((await api.post(`/api/sales/${staffSale.body.data._id}/confirm`).set(staffAuth)).status, 200);
      const ownSales = await api.get('/api/sales').set(staffAuth);
      assert.equal(ownSales.body.data.length, 1);

      const movements = await StockMovement.find({ product: productId }).sort({ createdAt: 1 });
      assert.equal(movements.length, 6);
      assert.ok(movements.every((movement) => movement.quantityAfter === movement.quantityBefore + movement.quantity));
      const report = await api.get('/api/reports/stock').set(adminAuth).query({ search: 'E2E-PEN-01' });
      assert.equal(report.status, 200, JSON.stringify(report.body));
      assert.equal(report.body.data[0].stockQty, 1);
    } finally {
      if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    }
  }
);
