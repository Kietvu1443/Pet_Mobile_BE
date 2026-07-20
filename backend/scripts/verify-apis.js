require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { pool } = require("../config/db");
const http = require("http");

const BASE = "http://localhost:3000";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;
let userToken, adminToken, reviewId, shelterId, deviceToken;

async function test(name, fn) {
  try {
    const result = await fn();
    if (result && result.skip) {
      console.log(`  ⏭️  ${name}`);
      return;
    }
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function expectStatus(res, expected) {
  if (res.status !== expected) {
    throw new Error(`Expected ${expected}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

(async () => {
  console.log("\n=== SETUP: Register & Login ===\n");

  const testUser = { display_name: "testuser_" + Date.now(), name: "Test User", email: `test${Date.now()}@test.com`, password: "Test1234!", confirmPassword: "Test1234!" };

  // Register regular user
  let res = await request("POST", "/api/v1/auth/register", testUser);
  expectStatus(res, 201);

  // Login
  res = await request("POST", "/api/v1/auth/login", { display_name: testUser.display_name, password: testUser.password });
  expectStatus(res, 200);
  userToken = res.body.data.token;
  const userId = res.body.data.user.id;

  // Make user an admin (role 0) for testing admin endpoints
  await pool.execute("UPDATE users SET role = 0 WHERE id = ?", [userId]);

  // Re-login to get a fresh JWT with the updated role
  res = await request("POST", "/api/v1/auth/login", { display_name: testUser.display_name, password: testUser.password });
  expectStatus(res, 200);
  adminToken = res.body.data.token;

  console.log(`  User ID: ${userId}, Role: admin\n`);

  // ============================================================
  console.log("=== HOUSING REVIEWS ===\n");

  // POST - create
  res = await request("POST", "/api/v1/housing-reviews/my", { house_type: "apartment", own_or_rent: "rent", has_allergies: false, has_pets: true }, userToken);
  expectStatus(res, 201);
  reviewId = res.body.data.review.id;
  console.log(`  ✅ POST /housing-reviews/my → 201, id=${reviewId}`); passed++;

  // POST - create duplicate (deactivates old, creates new)
  res = await request("POST", "/api/v1/housing-reviews/my", { house_type: "house", own_or_rent: "own", has_allergies: true, has_pets: false }, userToken);
  expectStatus(res, 201);
  reviewId = res.body.data.review.id;
  console.log(`  ✅ POST /housing-reviews/my (second) → 201, id=${reviewId}`); passed++;

  // GET - list my reviews
  res = await request("GET", "/api/v1/housing-reviews/my", null, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ GET /housing-reviews/my → 200, count=${res.body.data.reviews.length}`); passed++;

  // PATCH - update (id as query param)
  res = await request("PATCH", `/api/v1/housing-reviews/my?id=${reviewId}`, { house_type: "townhouse" }, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ PATCH /housing-reviews/my?id=${reviewId} → 200`); passed++;

  // Validation: missing fields
  res = await request("POST", "/api/v1/housing-reviews/my", {}, userToken);
  expectStatus(res, 400);
  console.log(`  ✅ POST /housing-reviews/my (missing fields) → 400`); passed++;

  // Validation: invalid house_type
  res = await request("POST", "/api/v1/housing-reviews/my", { house_type: "castle", own_or_rent: "rent" }, userToken);
  expectStatus(res, 400);
  console.log(`  ✅ POST /housing-reviews/my (invalid type) → 400`); passed++;

  // Unauthorized
  res = await request("GET", "/api/v1/housing-reviews/my");
  expectStatus(res, 401);
  console.log(`  ✅ GET /housing-reviews/my (no auth) → 401`); passed++;

  // ============================================================
  console.log("\n=== ADMIN: Housing Review Status ===\n");

  res = await request("PATCH", `/api/v1/admin/housing-reviews/${reviewId}/status`, { status: "approved", admin_notes: "Looks good" }, adminToken);
  expectStatus(res, 200);
  const updated = res.body.data.data;
  if (updated.status !== "approved") throw new Error("Status not updated");
  if (updated.reviewed_by !== userId) throw new Error("reviewed_by not set");
  if (!updated.reviewed_at) throw new Error("reviewed_at not set");
  console.log(`  ✅ PATCH /admin/housing-reviews/${reviewId}/status → 200, status=${updated.status}, reviewed_by=${updated.reviewed_by}`); passed++;

  // Conflict: already reviewed
  res = await request("PATCH", `/api/v1/admin/housing-reviews/${reviewId}/status`, { status: "rejected" }, adminToken);
  expectStatus(res, 409);
  console.log(`  ✅ PATCH /admin/housing-reviews/${reviewId}/status (duplicate) → 409`); passed++;

  // Validation: invalid status
  res = await request("PATCH", `/api/v1/admin/housing-reviews/${reviewId}/status`, { status: "invalid" }, adminToken);
  expectStatus(res, 400);
  console.log(`  ✅ PATCH /admin/housing-reviews/${reviewId}/status (invalid) → 400`); passed++;

  // Not found
  res = await request("PATCH", "/api/v1/admin/housing-reviews/99999/status", { status: "approved" }, adminToken);
  expectStatus(res, 404);
  console.log(`  ✅ PATCH /admin/housing-reviews/99999/status (not found) → 404`); passed++;

  // ============================================================
  console.log("\n=== SHELTERS ===\n");

  // POST - create
  res = await request("POST", "/api/v1/shelters", { name: "Test Shelter", description: "A test shelter", address: "123 Test St", phone: "0123456789" }, userToken);
  expectStatus(res, 201);
  shelterId = res.body.data.shelter.id;
  console.log(`  ✅ POST /shelters → 201, id=${shelterId}`); passed++;

  // GET - my shelter
  res = await request("GET", "/api/v1/shelters", null, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ GET /shelters → 200, name=${res.body.data.shelter?.name}`); passed++;

  // PATCH - update
  res = await request("PATCH", "/api/v1/shelters", { name: "Updated Shelter" }, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ PATCH /shelters → 200, name=${res.body.data.shelter?.name}`); passed++;

  // Conflict: duplicate creation
  res = await request("POST", "/api/v1/shelters", { name: "Another Shelter", address: "456 Other St", phone: "0987654321" }, userToken);
  expectStatus(res, 409);
  console.log(`  ✅ POST /shelters (duplicate) → 409`); passed++;

  // Validation: missing fields
  res = await request("POST", "/api/v1/shelters", {}, userToken);
  expectStatus(res, 400);
  console.log(`  ✅ POST /shelters (missing fields) → 400`); passed++;

  // Unauthorized
  res = await request("GET", "/api/v1/shelters");
  expectStatus(res, 401);
  console.log(`  ✅ GET /shelters (no auth) → 401`); passed++;

  // ============================================================
  console.log("\n=== ADMIN: Shelter Status ===\n");

  res = await request("PATCH", `/api/v1/admin/shelters/${shelterId}/status`, { status: "approved", admin_notes: "Verified" }, adminToken);
  expectStatus(res, 200);
  const shelterUpdated = res.body.data.data;
  if (shelterUpdated.status !== "approved") throw new Error("Status not updated");
  if (shelterUpdated.reviewed_by !== userId) throw new Error("reviewed_by not set");
  if (!shelterUpdated.reviewed_at) throw new Error("reviewed_at not set");
  console.log(`  ✅ PATCH /admin/shelters/${shelterId}/status → 200, status=${shelterUpdated.status}, reviewed_by=${shelterUpdated.reviewed_by}`); passed++;

  // Conflict
  res = await request("PATCH", `/api/v1/admin/shelters/${shelterId}/status`, { status: "rejected" }, adminToken);
  expectStatus(res, 409);
  console.log(`  ✅ PATCH /admin/shelters/${shelterId}/status (duplicate) → 409`); passed++;

  // Not found
  res = await request("PATCH", "/api/v1/admin/shelters/99999/status", { status: "approved" }, adminToken);
  expectStatus(res, 404);
  console.log(`  ✅ PATCH /admin/shelters/99999/status (not found) → 404`); passed++;

  // ============================================================
  console.log("\n=== DEVICES ===\n");

  deviceToken = "push_token_test_" + Date.now();

  // POST - register
  res = await request("POST", "/api/v1/devices", { push_token: deviceToken, device_platform: "ios" }, userToken);
  expectStatus(res, 201);
  console.log(`  ✅ POST /devices → 201`); passed++;

  // POST - duplicate token (upserts)
  res = await request("POST", "/api/v1/devices", { push_token: deviceToken, device_platform: "android" }, userToken);
  expectStatus(res, 201);
  console.log(`  ✅ POST /devices (duplicate/upsert) → 201`); passed++;

  // Validation: missing fields
  res = await request("POST", "/api/v1/devices", {}, userToken);
  expectStatus(res, 400);
  console.log(`  ✅ POST /devices (missing fields) → 400`); passed++;

  // DELETE - unregister
  res = await request("DELETE", `/api/v1/devices/${deviceToken}`, null, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ DELETE /devices/${deviceToken} → 200`); passed++;

  // DELETE - not found
  res = await request("DELETE", "/api/v1/devices/nonexistent_token", null, userToken);
  expectStatus(res, 404);
  console.log(`  ✅ DELETE /devices/nonexistent (not found) → 404`); passed++;

  // Unauthorized
  res = await request("POST", "/api/v1/devices", { push_token: "test", device_platform: "ios" });
  expectStatus(res, 401);
  console.log(`  ✅ POST /devices (no auth) → 401`); passed++;

  // ============================================================
  console.log("\n=== REGRESSION: Auth & Profile ===\n");

  // Login
  res = await request("POST", "/api/v1/auth/login", { display_name: testUser.display_name, password: testUser.password });
  expectStatus(res, 200);
  userToken = res.body.data.token;
  console.log(`  ✅ POST /auth/login → 200`); passed++;

  // GET /auth/me
  res = await request("GET", "/api/v1/auth/me", null, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ GET /auth/me → 200`); passed++;

  // PATCH /auth/profile
  res = await request("PATCH", "/api/v1/auth/profile", { display_name: testUser.display_name, name: "Updated Name", email: testUser.email }, userToken);
  expectStatus(res, 200);
  console.log(`  ✅ PATCH /auth/profile → 200`); passed++;

  // ============================================================
  console.log("\n=== REGRESSION: Existing Admin Endpoints ===\n");

  // GET /admin/users
  res = await request("GET", "/api/v1/admin/users", null, adminToken);
  expectStatus(res, 200);
  console.log(`  ✅ GET /admin/users → 200`); passed++;

  // GET /admin/reports
  res = await request("GET", "/api/v1/admin/reports", null, adminToken);
  expectStatus(res, 200);
  console.log(`  ✅ GET /admin/reports → 200`); passed++;

  // ============================================================
  console.log("\n========================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  // Cleanup: restore regular user role
  await pool.execute("UPDATE users SET role = 2 WHERE id = ?", [userId]);

  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
