function success(res, data, message, status = 200) {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

function paginated(res, data, page, limit, total) {
  return res.json({
    success: true,
    data,
    meta: { page, total, limit, totalPages: Math.ceil(total / limit) }
  });
}

module.exports = { success, paginated };
