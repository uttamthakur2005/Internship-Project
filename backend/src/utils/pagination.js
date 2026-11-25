const ApiError = require('./ApiError');

const SORTABLE_FIELDS = new Set([
  'name',
  'sku',
  'status',
  'stockQty',
  'minStockLevel',
  'createdAt',
  'updatedAt',
  'purchaseDate',
  'saleDate',
  'receivedAt',
  'confirmedAt',
  'referenceNo',
  'total'
]);

function parseListQuery(query, allowedSortFields = SORTABLE_FIELDS) {
  if (
    (query.page !== undefined && typeof query.page !== 'string') ||
    (query.limit !== undefined && typeof query.limit !== 'string') ||
    (query.sort !== undefined && typeof query.sort !== 'string')
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'page, limit, and sort must each be supplied once');
  }
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'page and limit must be positive integers; limit cannot exceed 100');
  }

  const sort = query.sort || '-createdAt';
  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  if (!allowedSortFields.has(sortField)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported sort field: ${sortField}`);
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [sortField]: sort.startsWith('-') ? -1 : 1 }
  };
}

function dateRange(query, field) {
  const filter = {};
  if (query.from || query.to) {
    const range = {};
    if (query.from) {
      const start = new Date(`${query.from}T00:00:00+05:30`);
      if (Number.isNaN(start.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid from date');
      range.$gte = start;
    }
    if (query.to) {
      const end = new Date(`${query.to}T23:59:59.999+05:30`);
      if (Number.isNaN(end.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid to date');
      range.$lte = end;
    }
    filter[field] = range;
  }
  return filter;
}

module.exports = { parseListQuery, dateRange };
