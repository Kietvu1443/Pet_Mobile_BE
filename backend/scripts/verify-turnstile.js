require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const http = require("http");
const { verifyTurnstileToken } = require("../service/turnstileService");

const BASE = process.env.BASE_URL || "http://localhost:3000";

// Cloudflare Official Test Credentials (guaranteed static behavior by Cloudflare)
const CF_TEST_PASS_SECRET = "1x0000000000000000000000000000000AA";
const CF_TEST_FAIL_SECRET = "2x0000000000000000000000000000000AA";
const CF_TEST_SPENT_SECRET = "3x0000000000000000000000000000000AA";
const CF_TEST_DUMMY_TOKEN = "1x00000000000000000000AA";

function request(method, path, body, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        ...customHeaders,
      },
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
        });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function expectStatus(res, expected) {
  if (res.status !== expected) {
    throw new Error(`Expected status ${expected}, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
}

function assertNoSecretLeak(res, secretKey) {
  if (!secretKey) return;
  const rawBody = typeof res.body === "string" ? res.body : JSON.stringify(res.body);
  if (rawBody.includes(secretKey)) {
    throw new Error("SECURITY VIOLATION: Secret Key was found in response body!");
  }
  const rawHeaders = JSON.stringify(res.headers);
  if (rawHeaders.includes(secretKey)) {
    throw new Error("SECURITY VIOLATION: Secret Key was found in response headers!");
  }
}

(async () => {
  console.log("============================================================");
  console.log("     CLOUDFLARE TURNSTILE VERIFICATION TEST SUITE           ");
  console.log("============================================================\n");

  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn("⚠️ Warning: CLOUDFLARE_TURNSTILE_SECRET_KEY not found in backend/.env");
  }

  // ──────────────────────────────────────────────────────────
  // 1. Service-Level Unit Tests (Using Official Cloudflare Test Keys)
  // ──────────────────────────────────────────────────────────
  console.log("=== 1. Turnstile Service Unit Tests (Official Cloudflare Keys) ===");

  await test("Service verifies token with Cloudflare dummy PASS secret", async () => {
    const result = await verifyTurnstileToken({
      token: CF_TEST_DUMMY_TOKEN,
      secretKey: CF_TEST_PASS_SECRET,
    });
    if (!result.success) {
      throw new Error(`Expected success=true, got: ${JSON.stringify(result)}`);
    }
  });

  await test("Service rejects token with Cloudflare dummy FAIL secret", async () => {
    const result = await verifyTurnstileToken({
      token: CF_TEST_DUMMY_TOKEN,
      secretKey: CF_TEST_FAIL_SECRET,
    });
    if (result.success !== false) {
      throw new Error(`Expected success=false, got: ${JSON.stringify(result)}`);
    }
    if (!Array.isArray(result.errorCodes) || result.errorCodes.length === 0) {
      throw new Error("Expected Cloudflare error-codes in failure response");
    }
  });

  await test("Service handles duplicate/spent token with Cloudflare dummy SPENT secret", async () => {
    const result = await verifyTurnstileToken({
      token: CF_TEST_DUMMY_TOKEN,
      secretKey: CF_TEST_SPENT_SECRET,
    });
    if (result.success !== false) {
      throw new Error(`Expected success=false, got: ${JSON.stringify(result)}`);
    }
    if (!result.errorCodes?.includes("timeout-or-duplicate")) {
      throw new Error(`Expected timeout-or-duplicate, got: ${JSON.stringify(result.errorCodes)}`);
    }
  });

  await test("Service rejects empty or missing token before making API call", async () => {
    const result = await verifyTurnstileToken({ token: "" });
    if (result.success !== false || result.error !== "MISSING_TOKEN") {
      throw new Error(`Expected MISSING_TOKEN, got: ${JSON.stringify(result)}`);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 2. Integration Tests: Protected Authentication Endpoints
  // ──────────────────────────────────────────────────────────
  console.log("\n=== 2. Route Integration Tests: Web Client Enforcement ===");

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Origin": "http://localhost:3000",
    "Referer": "http://localhost:3000/",
    "Sec-Ch-Ua": '"Chromium";v="122"',
  };

  await test("POST /api/v1/auth/login - Web client with missing token is rejected (400)", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
    }, browserHeaders);

    expectStatus(res, 400);
    if (res.body.success !== false) throw new Error("Expected success=false");
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /api/v1/auth/login - Web client with invalid token is rejected (403)", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
      turnstileToken: "invalid_turnstile_test_token",
    }, browserHeaders);

    expectStatus(res, 403);
    if (res.body.success !== false) throw new Error("Expected success=false");
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /api/v1/auth/register - Web client with missing token is rejected (400)", async () => {
    const res = await request("POST", "/api/v1/auth/register", {
      display_name: "test_bot_" + Date.now(),
      name: "Bot User",
      email: `bot_${Date.now()}@test.com`,
      password: "TestPassword123!",
      confirmPassword: "TestPassword123!",
    }, browserHeaders);

    expectStatus(res, 400);
    if (res.body.success !== false) throw new Error("Expected success=false");
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /api/v1/auth/register - Web client with invalid token is rejected (403)", async () => {
    const res = await request("POST", "/api/v1/auth/register", {
      display_name: "test_bot_" + Date.now(),
      name: "Bot User",
      email: `bot_${Date.now()}@test.com`,
      password: "TestPassword123!",
      confirmPassword: "TestPassword123!",
      turnstileToken: "invalid_turnstile_test_token",
    }, browserHeaders);

    expectStatus(res, 403);
    if (res.body.success !== false) throw new Error("Expected success=false");
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /auth/login - Web auth route with missing token is rejected (400)", async () => {
    const res = await request("POST", "/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
    }, browserHeaders);

    expectStatus(res, 400);
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /auth/login - Web auth route with invalid token is rejected (403)", async () => {
    const res = await request("POST", "/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
      turnstileToken: "invalid_turnstile_test_token",
    }, browserHeaders);

    expectStatus(res, 403);
    assertNoSecretLeak(res, secretKey);
  });

  // ──────────────────────────────────────────────────────────
  // 3. Mobile App Compatibility & Security Tests
  // ──────────────────────────────────────────────────────────
  console.log("\n=== 3. Mobile App Compatibility & Security Tests ===");

  const mobileHeaders = {
    "Accept": "application/json",
    "User-Agent": "okhttp/4.9.2 PetMobile/1.0",
    "x-client-platform": "mobile",
  };

  await test("POST /api/v1/auth/login - Mobile client without token bypasses Turnstile (preserves mobile auth)", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "non_existent_user_test",
      password: "WrongPassword123!",
    }, mobileHeaders);

    // Should NOT be 400 or 403 from Turnstile.
    // The login controller will execute and return 401 (wrong credentials).
    expectStatus(res, 401);
    if (res.body.message !== "Tên đăng nhập hoặc mật khẩu bị sai") {
      throw new Error(`Expected login controller response, got: ${JSON.stringify(res.body)}`);
    }
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /api/v1/auth/login - Mobile client WITH invalid token is rejected (403)", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
      turnstileToken: "invalid_token_from_mobile",
    }, mobileHeaders);

    // If mobile client provides a token, it MUST be valid
    expectStatus(res, 403);
    assertNoSecretLeak(res, secretKey);
  });

  // ──────────────────────────────────────────────────────────
  // 4. Token Header Support Tests
  // ──────────────────────────────────────────────────────────
  console.log("\n=== 4. Alternative Token Field & Header Tests ===");

  await test("POST /api/v1/auth/login - Accepts token via x-turnstile-token header", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
    }, {
      ...browserHeaders,
      "x-turnstile-token": "invalid_header_token",
    });

    // Token was extracted and verified against Cloudflare (which rejects invalid dummy token with 403, NOT 400 missing)
    expectStatus(res, 403);
    assertNoSecretLeak(res, secretKey);
  });

  await test("POST /api/v1/auth/login - Accepts token via cf-turnstile-response body field", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
      "cf-turnstile-response": "invalid_cf_form_token",
    }, browserHeaders);

    // Token was extracted and verified against Cloudflare (403 invalid, NOT 400 missing)
    expectStatus(res, 403);
    assertNoSecretLeak(res, secretKey);
  });

  // ──────────────────────────────────────────────────────────
  // 5. Valid Token & Config Tests
  // ──────────────────────────────────────────────────────────
  console.log("\n=== 5. Valid Test Token & Public Config Verification ===");

  await test("POST /api/v1/auth/login - Web client with valid test token passes Turnstile", async () => {
    const res = await request("POST", "/api/v1/auth/login", {
      display_name: "testuser",
      password: "TestPassword123!",
      turnstileToken: CF_TEST_DUMMY_TOKEN,
    }, browserHeaders);

    // Passes Turnstile middleware and reaches login controller (returns 401 for wrong credentials)
    expectStatus(res, 401);
    if (res.body.message !== "Tên đăng nhập hoặc mật khẩu bị sai") {
      throw new Error(`Expected login controller response, got: ${JSON.stringify(res.body)}`);
    }
    assertNoSecretLeak(res, secretKey);
  });

  await test("GET /api/v1/auth/config - Returns environment test site key and no secret leaks", async () => {
    const res = await request("GET", "/api/v1/auth/config", null);
    expectStatus(res, 200);
    if (res.body.data?.turnstileSiteKey !== "1x00000000000000000000AA") {
      throw new Error(`Expected test site key 1x00000000000000000000AA, got: ${res.body.data?.turnstileSiteKey}`);
    }
    assertNoSecretLeak(res, secretKey);
  });

  // ──────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────
  console.log("\n============================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
