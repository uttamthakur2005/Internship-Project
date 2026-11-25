const { body, param } = require('express-validator');
const validate = require('../middleware/validate');

const id = [param('id').isMongoId().withMessage('id must be a valid MongoDB id'), validate];
const login = [
  body('email').isEmail().withMessage('email must be valid'),
  body('password').isString().notEmpty().withMessage('password is required'),
  validate
];
const profile = [
  body('name').optional().isLength({ min: 2, max: 60 }).trim(),
  body('phone').optional().isString().isLength({ max: 30 }).trim(),
  validate
];
const passwordChange = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8, max: 128 }),
  validate
];
const createUser = [
  body('name').isString().isLength({ min: 2, max: 60 }).trim(),
  body('email').isEmail().trim().toLowerCase(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('role').isIn(['admin', 'manager', 'staff']),
  body('phone').optional().isString().isLength({ max: 30 }).trim(),
  body('extraPermissions').optional().isArray(),
  validate
];
const updateUser = [
  body('name').optional().isString().isLength({ min: 2, max: 60 }).trim(),
  body('phone').optional().isString().isLength({ max: 30 }).trim(),
  body('role').optional().isIn(['admin', 'manager', 'staff']),
  body('extraPermissions').optional().isArray(),
  validate
];
const userStatus = [body('isActive').isBoolean().toBoolean(), validate];
const categoryCreate = [
  body('name').isString().isLength({ min: 2, max: 50 }).trim(),
  body('description').optional().isString().isLength({ max: 300 }).trim(),
  validate
];
const categoryUpdate = [
  body('name').optional().isString().isLength({ min: 2, max: 50 }).trim(),
  body('description').optional().isString().isLength({ max: 300 }).trim(),
  body('isActive').optional().isBoolean().toBoolean(),
  validate
];
const createProduct = [
  body('name').isString().isLength({ min: 2, max: 120 }).trim(),
  body('sku').isString().matches(/^[A-Za-z0-9-]{3,30}$/),
  body('category').isMongoId(),
  body('unit').isIn(['pcs', 'box', 'pack', 'kg', 'g', 'l', 'ml', 'm']),
  body('purchasePrice').isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('sellingPrice').isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('minStockLevel').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('description').optional().isString().isLength({ max: 1000 }).trim(),
  body('barcode').optional({ checkFalsy: true }).isString().isLength({ max: 100 }).trim(),
  validate
];
const updateProduct = [
  body('name').optional().isString().isLength({ min: 2, max: 120 }).trim(),
  body('sku').optional().isString().matches(/^[A-Za-z0-9-]{3,30}$/),
  body('category').optional().isMongoId(),
  body('unit').optional().isIn(['pcs', 'box', 'pack', 'kg', 'g', 'l', 'ml', 'm']),
  body('purchasePrice').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('sellingPrice').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('minStockLevel').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('description').optional().isString().isLength({ max: 1000 }).trim(),
  body('barcode').optional({ checkFalsy: true }).isString().isLength({ max: 100 }).trim(),
  validate
];
const productStatus = [body('status').isIn(['active', 'inactive']), validate];
const supplierCreate = [
  body('name').isString().isLength({ min: 2, max: 100 }).trim(),
  body('phone').matches(/^\d{10,15}$/),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  validate
];
const customerCreate = [
  body('name').isString().isLength({ min: 2, max: 100 }).trim(),
  body('phone').optional({ checkFalsy: true }).matches(/^\d{10,15}$/),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  validate
];
const contactUpdate = [
  body('name').optional().isString().isLength({ min: 2, max: 100 }).trim(),
  body('phone').optional({ checkFalsy: true }).matches(/^\d{10,15}$/),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('isActive').optional().isBoolean().toBoolean(),
  validate
];
const openingStock = [
  body('productId').isMongoId(),
  body('quantity').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('unitCost').isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('note').isString().notEmpty().isLength({ max: 500 }).trim(),
  validate
];
const adjustment = [
  body('productId').isMongoId(),
  body('direction').isIn(['in', 'out']),
  body('quantity').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('reason').isIn(['COUNT_CORRECTION', 'DAMAGED', 'LOST', 'FOUND', 'EXPIRED', 'OTHER']),
  body('note').optional().isString().isLength({ max: 500 }).trim(),
  validate
];
const purchaseCreate = [
  body('supplier').isMongoId(),
  body('purchaseDate').isISO8601(),
  body('items').isArray({ min: 1 }),
  body('items.*.product').isMongoId(),
  body('items.*.quantity').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('items.*.unitCost').isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('notes').optional().isString().isLength({ max: 500 }).trim(),
  validate
];
const purchaseUpdate = [
  body('supplier').optional().isMongoId(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.product').optional().isMongoId(),
  body('items.*.quantity').optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('items.*.unitCost').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('purchaseDate').optional().isISO8601(),
  body('notes').optional().isString().isLength({ max: 500 }).trim(),
  validate
];
const saleCreate = [
  body('customer').optional({ checkFalsy: true }).isMongoId(),
  body('saleDate').isISO8601(),
  body('items').isArray({ min: 1 }),
  body('items.*.product').isMongoId(),
  body('items.*.quantity').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('items.*.unitPrice').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  validate
];
const saleUpdate = [
  body('customer').optional({ checkFalsy: true }).isMongoId(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.product').optional().isMongoId(),
  body('items.*.quantity').optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('items.*.unitPrice').optional().isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('saleDate').optional().isISO8601(),
  validate
];
const cancellation = [
  body('reason').isString().notEmpty().isLength({ max: 500 }).trim(),
  validate
];

module.exports = {
  id,
  login,
  profile,
  passwordChange,
  createUser,
  updateUser,
  userStatus,
  categoryCreate,
  categoryUpdate,
  createProduct,
  updateProduct,
  productStatus,
  supplierCreate,
  customerCreate,
  contactUpdate,
  openingStock,
  adjustment,
  purchaseCreate,
  purchaseUpdate,
  saleCreate,
  saleUpdate,
  cancellation
};
