const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const ApiError = require('../utils/ApiError');
const { success, paginated } = require('../utils/respond');
const { parseListQuery } = require('../utils/pagination');
const transactionService = require('../services/transaction.service');

function purchaseList(req, res) {
  return list(req, res, Purchase, 'purchase');
}

function saleList(req, res) {
  return list(req, res, Sale, 'sale');
}

async function list(req, res, Model, kind) {
  const result = await transactionService.listTransactions(Model, req.query, req.user, kind);
  return paginated(res, result.data, result.page, result.limit, result.total);
}

async function getPurchase(req, res) {
  return success(res, await transactionService.getTransaction(Purchase, req.params.id, req.user, 'purchase'));
}

async function getSale(req, res) {
  return success(res, await transactionService.getTransaction(Sale, req.params.id, req.user, 'sale'));
}

async function createPurchase(req, res) {
  rejectUnknown(req.body, ['supplier', 'purchaseDate', 'items', 'notes']);
  const record = await transactionService.createPurchase(req.body, req.user);
  return success(res, record, 'Purchase created', 201);
}

async function updatePurchase(req, res) {
  rejectUnknown(req.body, ['supplier', 'items', 'purchaseDate', 'notes']);
  return success(res, await transactionService.updatePurchase(req.params.id, req.body, req.user), 'Purchase updated');
}

async function orderPurchase(req, res) {
  return success(res, await transactionService.orderPurchase(req.params.id, req.user), 'Purchase ordered');
}

async function receivePurchase(req, res) {
  const { purchase, movements } = await transactionService.receivePurchase(req.params.id, req.user);
  return success(res, { ...purchase.toObject(), movements }, 'Purchase received');
}

async function cancelPurchase(req, res) {
  if (typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cancellation reason is required');
  }
  return success(res, await transactionService.cancelPurchase(req.params.id, req.body.reason, req.user), 'Purchase cancelled');
}

async function createSale(req, res) {
  rejectUnknown(req.body, ['customer', 'saleDate', 'items']);
  const record = await transactionService.createSale(req.body, req.user);
  return success(res, record, 'Sale created', 201);
}

async function updateSale(req, res) {
  rejectUnknown(req.body, ['customer', 'items', 'saleDate']);
  return success(res, await transactionService.updateSale(req.params.id, req.body, req.user), 'Sale updated');
}

async function confirmSale(req, res) {
  const { sale, movements } = await transactionService.confirmSale(req.params.id, req.user);
  return success(res, { ...sale.toObject(), movements }, 'Sale confirmed');
}

async function cancelSale(req, res) {
  if (typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cancellation reason is required');
  }
  return success(res, await transactionService.cancelSale(req.params.id, req.body.reason, req.user), 'Sale cancelled');
}

function rejectUnknown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported fields: ${unknown.join(', ')}`);
}

module.exports = {
  purchaseList,
  saleList,
  getPurchase,
  getSale,
  createPurchase,
  updatePurchase,
  orderPurchase,
  receivePurchase,
  cancelPurchase,
  createSale,
  updateSale,
  confirmSale,
  cancelSale
};
