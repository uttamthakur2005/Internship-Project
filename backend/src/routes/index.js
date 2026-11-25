const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requirePermission } = require('../middleware/auth');
const { success } = require('../utils/respond');
const ApiError = require('../utils/ApiError');
const validators = require('../validators');
const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const settings = require('../controllers/settings.controller');
const catalog = require('../controllers/catalog.controller');
const contacts = require('../controllers/contacts.controller');
const stock = require('../controllers/stock.controller');
const transactions = require('../controllers/transactions.controller');
const reports = require('../controllers/reports.controller');

const router = express.Router();
const { id } = validators;

const anyPermission = (...permissions) => (req, res, next) => {
  if (!permissions.some((permission) => req.user.permissions.includes(permission))) {
    return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
  }
  return next();
};

router.get('/health', (req, res) => success(res, { status: 'ok' }));

router.post('/auth/login', ...validators.login, asyncHandler(auth.login));
router.get('/auth/me', protect, asyncHandler(auth.me));
router.post('/auth/logout', protect, asyncHandler(auth.logout));
router.patch('/auth/me', protect, ...validators.profile, asyncHandler(auth.updateMe));
router.patch('/auth/me/password', protect, ...validators.passwordChange, asyncHandler(auth.changePassword));

router.get('/users', protect, requirePermission('users.manage'), asyncHandler(users.list));
router.post('/users', protect, requirePermission('users.manage'), ...validators.createUser, asyncHandler(users.create));
router.get('/users/:id', protect, requirePermission('users.manage'), ...id, asyncHandler(users.get));
router.patch('/users/:id', protect, requirePermission('users.manage'), ...id, ...validators.updateUser, asyncHandler(users.update));
router.patch('/users/:id/status', protect, requirePermission('users.manage'), ...id, ...validators.userStatus, asyncHandler(users.updateStatus));

router.get('/settings', protect, asyncHandler(settings.get));
router.patch('/settings', protect, requirePermission('settings.manage'), asyncHandler(settings.update));

router.get('/categories', protect, requirePermission('products.view'), asyncHandler(catalog.listCategories));
router.post('/categories', protect, requirePermission('products.manage'), ...validators.categoryCreate, asyncHandler(catalog.createCategory));
router.patch('/categories/:id', protect, requirePermission('products.manage'), ...id, ...validators.categoryUpdate, asyncHandler(catalog.updateCategory));
router.get('/products', protect, requirePermission('products.view'), asyncHandler(catalog.listProducts));
router.post('/products', protect, requirePermission('products.manage'), ...validators.createProduct, asyncHandler(catalog.createProduct));
router.get('/products/:id', protect, requirePermission('products.view'), ...id, asyncHandler(catalog.getProduct));
router.patch('/products/:id', protect, requirePermission('products.manage'), ...id, ...validators.updateProduct, asyncHandler(catalog.updateProduct));
router.patch('/products/:id/status', protect, requirePermission('products.manage'), ...id, ...validators.productStatus, asyncHandler(catalog.updateProductStatus));

for (const [prefix, handlers] of [['suppliers', contacts.suppliers], ['customers', contacts.customers]]) {
  const isSupplier = prefix === 'suppliers';
  const listPermission = isSupplier ? 'contacts.manage' : 'customers.view';
  const createValidator = isSupplier ? validators.supplierCreate : validators.customerCreate;
  router.get(`/${prefix}`, protect, requirePermission(listPermission), asyncHandler(handlers.list));
  router.post(`/${prefix}`, protect, requirePermission('contacts.manage'), ...createValidator, asyncHandler(handlers.create));
  router.get(`/${prefix}/:id`, protect, requirePermission(listPermission), ...id, asyncHandler(handlers.get));
  router.patch(
    `/${prefix}/:id`,
    protect,
    requirePermission('contacts.manage'),
    ...id,
    ...validators.contactUpdate,
    asyncHandler(handlers.update)
  );
}
router.get(
  '/suppliers/:id/purchases',
  protect,
  requirePermission('contacts.manage'),
  ...id,
  asyncHandler(contacts.suppliers.history)
);
router.get(
  '/customers/:id/sales',
  protect,
  requirePermission('sales.view'),
  ...id,
  asyncHandler(contacts.customers.history)
);

router.post('/stock/opening', protect, requirePermission('stock.adjust'), ...validators.openingStock, asyncHandler(stock.opening));
router.post('/stock/adjustments', protect, requirePermission('stock.adjust'), ...validators.adjustment, asyncHandler(stock.adjustment));
router.get('/stock/movements', protect, requirePermission('stock.view'), asyncHandler(stock.movements));

router.get('/purchases', protect, requirePermission('purchases.manage'), asyncHandler(transactions.purchaseList));
router.post('/purchases', protect, requirePermission('purchases.manage'), ...validators.purchaseCreate, asyncHandler(transactions.createPurchase));
router.get('/purchases/:id', protect, requirePermission('purchases.manage'), ...id, asyncHandler(transactions.getPurchase));
router.patch('/purchases/:id', protect, requirePermission('purchases.manage'), ...id, ...validators.purchaseUpdate, asyncHandler(transactions.updatePurchase));
router.post('/purchases/:id/order', protect, requirePermission('purchases.manage'), ...id, asyncHandler(transactions.orderPurchase));
router.post('/purchases/:id/receive', protect, requirePermission('purchases.manage'), ...id, asyncHandler(transactions.receivePurchase));
router.post('/purchases/:id/cancel', protect, requirePermission('purchases.manage'), ...id, ...validators.cancellation, asyncHandler(transactions.cancelPurchase));

router.get('/sales', protect, requirePermission('sales.view'), asyncHandler(transactions.saleList));
router.post('/sales', protect, requirePermission('sales.create'), ...validators.saleCreate, asyncHandler(transactions.createSale));
router.get('/sales/:id', protect, requirePermission('sales.view'), ...id, asyncHandler(transactions.getSale));
router.patch('/sales/:id', protect, requirePermission('sales.create'), ...id, ...validators.saleUpdate, asyncHandler(transactions.updateSale));
router.post('/sales/:id/confirm', protect, requirePermission('sales.create'), ...id, asyncHandler(transactions.confirmSale));
router.post('/sales/:id/cancel', protect, anyPermission('sales.cancel', 'sales.create'), ...id, ...validators.cancellation, asyncHandler(transactions.cancelSale));

router.get('/dashboard/summary', protect, requirePermission('dashboard.view'), asyncHandler(reports.summary));
router.get('/dashboard/trends', protect, requirePermission('dashboard.view'), asyncHandler(reports.trends));
router.get('/reports/stock', protect, requirePermission('reports.view'), asyncHandler(reports.stockReport));
router.get('/reports/low-stock', protect, requirePermission('reports.view'), asyncHandler(reports.lowStock));
router.get('/reports/out-of-stock', protect, requirePermission('reports.view'), asyncHandler(reports.outOfStock));
router.get('/reports/purchases', protect, requirePermission('reports.view'), asyncHandler(reports.purchaseReport));
router.get('/reports/sales', protect, requirePermission('reports.view'), asyncHandler(reports.saleReport));
router.get('/reports/movements', protect, requirePermission('reports.view'), asyncHandler(reports.movementReport));

module.exports = router;
