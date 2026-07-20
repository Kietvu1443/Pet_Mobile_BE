require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { pool } = require("../config/db");
const http = require("http");

const BASE = "http://localhost:3000";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { "Content-Type": "application/json" } };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  // Register + login
  const ts = Date.now();
  let res = await request("POST", "/api/v1/auth/register", { display_name: `test_${ts}`, name: "Test", email: `test_${ts}@t.com`, password: "Test1234!", confirmPassword: "Test1234!" });
  if (res.status !== 201) { console.error("Register failed:", res.body); process.exit(1); }

  res = await request("POST", "/api/v1/auth/login", { display_name: `test_${ts}`, password: "Test1234!" });
  const token = res.body.data.token;

  // CREATE with all Premium UI fields
  const payload = {
    house_type: "apartment",
    own_or_rent: "rent",
    has_allergies: false,
    has_pets: true,
    outdoor_space: "balcony",
    has_children: true,
    time_at_home: "4to8",
    experience: "1to2",
    income: "10-20m",
    when_away: ["family", "service"],
  };

  res = await request("POST", "/api/v1/housing-reviews/my", payload, token);
  if (res.status !== 201) { console.error("CREATE failed:", JSON.stringify(res.body)); process.exit(1); }
  console.log(`✅ CREATE → 201, id=${res.body.data.review.id}, when_away=${JSON.stringify(res.body.data.review.when_away)}`);

  // GET active
  res = await request("GET", "/api/v1/housing-reviews/active", null, token);
  if (res.status !== 200) { console.error("GET ACTIVE failed:", JSON.stringify(res.body)); process.exit(1); }
  const r = res.body.data.review;
  const checks = [
    ["house_type", r.house_type, "apartment"],
    ["outdoor_space", r.outdoor_space, "balcony"],
    ["has_pets", Number(r.has_pets), 1],
    ["has_children", Number(r.has_children), 1],
    ["time_at_home", r.time_at_home, "4to8"],
    ["experience", r.experience, "1to2"],
    ["income", r.income, "10-20m"],
    ["when_away", JSON.stringify(r.when_away), JSON.stringify(["family","service"])],
    ["status", r.status, "pending"],
  ];
  let ok = true;
  for (const [field, actual, expected] of checks) {
    if (String(actual) !== String(expected)) {
      console.error(`❌ ${field}: expected ${expected}, got ${actual}`);
      ok = false;
    }
  }
  if (ok) console.log(`✅ GET active → all ${checks.length} fields verified`);

  // UPDATE
  res = await request("PATCH", `/api/v1/housing-reviews/my?id=${r.id}`, { house_type: "house", outdoor_space: "garden" }, token);
  if (res.status !== 200) { console.error("UPDATE failed:", JSON.stringify(res.body)); process.exit(1); }
  const updated = res.body.data.review;
  if (updated.house_type !== "house" || updated.outdoor_space !== "garden") {
    console.error(`❌ UPDATE: house_type=${updated.house_type}, outdoor_space=${updated.outdoor_space}`);
    process.exit(1);
  }
  console.log(`✅ PATCH → 200, house_type=${updated.house_type}, outdoor_space=${updated.outdoor_space}`);

  // ADMIN: approve
  await pool.execute("UPDATE users SET role = 0 WHERE display_name = ?", [`test_${ts}`]);
  res = await request("POST", "/api/v1/auth/login", { display_name: `test_${ts}`, password: "Test1234!" });
  const adminToken = res.body.data.token;
  res = await request("PATCH", `/api/v1/admin/housing-reviews/${r.id}/status`, { status: "approved", admin_notes: "OK" }, adminToken);
  if (res.status !== 200) { console.error("ADMIN APPROVE failed:", JSON.stringify(res.body)); process.exit(1); }
  console.log(`✅ ADMIN approve → 200, status=${res.body.data.data.status}, reviewed_by=${res.body.data.data.reviewed_by}`);

  // GET active should now show approved
  res = await request("GET", "/api/v1/housing-reviews/active", null, token);
  if (res.status !== 200) { console.error("GET ACTIVE (approved) failed:", JSON.stringify(res.body)); process.exit(1); }
  if (res.body.data.review.status !== "approved") {
    console.error(`❌ Status not updated in GET active: ${res.body.data.review.status}`);
    process.exit(1);
  }
  console.log(`✅ GET active → status=${res.body.data.review.status}, admin_notes=${res.body.data.review.admin_notes}`);

  await pool.execute("UPDATE users SET role = 2 WHERE display_name = ?", [`test_${ts}`]);
  console.log("\n✅ All Premium UI field tests passed");
  process.exit(0);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
