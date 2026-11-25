const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
const { effectivePermissions } = require("../src/config/permissions");
const StockMovement = require("../src/models/StockMovement");

test("health endpoint returns the API status without authentication", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: { status: "ok" },
  });
});

test("unknown API routes use the standard not-found response", async () => {
  const response = await request(app).get("/api/not-a-route");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    error: { code: "NOT_FOUND", message: "Resource not found" },
  });
});

test("malformed JSON uses the shared validation error format", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email":');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("protected APIs return 401 without a token and allow bodyless action requests to reach auth", async () => {
  const productResponse = await request(app).get("/api/products");
  assert.equal(productResponse.status, 401);
  assert.equal(productResponse.body.error.code, "UNAUTHENTICATED");

  const logoutResponse = await request(app).post("/api/auth/logout");
  assert.equal(logoutResponse.status, 401);
  assert.equal(logoutResponse.body.error.code, "UNAUTHENTICATED");
});

test("role defaults and the staff sales grant match the permission contract", () => {
  assert.deepEqual(effectivePermissions({ role: "staff" }), [
    "products.view",
    "customers.view",
    "sales.view",
  ]);
  assert.deepEqual(
    effectivePermissions({
      role: "staff",
      extraPermissions: ["sales.create", "users.manage"],
    }),
    ["products.view", "customers.view", "sales.view", "sales.create"],
  );
  assert.ok(
    effectivePermissions({ role: "manager" }).includes("purchases.manage"),
  );
  assert.ok(
    !effectivePermissions({ role: "manager" }).includes("users.manage"),
  );
});

test("stock movement model enforces signed quantity and before/after reconciliation", () => {
  const valid = new StockMovement({
    product: "665f00000000000000000001",
    productSnapshot: { name: "Pen", sku: "PEN-01" },
    type: "SALE_OUT",
    quantity: -2,
    quantityBefore: 3,
    quantityAfter: 1,
    performedBy: "665f00000000000000000002",
  });
  assert.equal(valid.validateSync(), undefined);

  const invalid = new StockMovement({
    product: "665f00000000000000000001",
    productSnapshot: { name: "Pen", sku: "PEN-01" },
    type: "SALE_OUT",
    quantity: -2,
    quantityBefore: 3,
    quantityAfter: 2,
    performedBy: "665f00000000000000000002",
  });
  const error = invalid.validateSync();
  assert.ok(error.errors.quantityAfter);
});
