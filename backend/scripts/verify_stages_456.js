const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'pet-helper-jwt-secret-2026';
const BASE_URL = 'http://localhost:3000/api/v1';

async function runStages456() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT || 3306;
  const dbName = 'pet_helper';

  const conn = await mysql.createConnection({ host, port, user, password, database: dbName });

  const results = {
    stage4_backend_startup: { pass: false, details: {} },
    stage5_existing_api: { pass: false, details: {} },
    stage6_best_match_petsnap: { pass: false, details: {} }
  };

  // Create temporary valid tokens for testing (User 29 and User 3)
  const tokenUser3 = jwt.sign({ id: 3, email: 'admin@pethelper.test', role: 0 }, JWT_SECRET, { expiresIn: '15m' });
  const tokenUser29 = jwt.sign({ id: 29, email: 'adopter@pethelper.test', role: 2 }, JWT_SECRET, { expiresIn: '15m' });

  // ==========================================
  // STAGE 4: BACKEND STARTUP
  // ==========================================
  console.log('--- STAGE 4: BACKEND STARTUP ---');
  let stage4Pass = false;
  let stage4Details = {};
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();

    const [dbTest] = await conn.query('SELECT 1 + 1 AS sum');

    stage4Pass = healthRes.status === 200 && healthData.status === 'ok' && dbTest[0].sum === 2;
    stage4Details = {
      httpStatus: healthRes.status,
      healthStatus: healthData.status,
      dbQueryTest: dbTest[0].sum === 2 ? 'OK' : 'FAIL',
      database: dbName
    };
  } catch (err) {
    stage4Details = { error: err.message };
  }
  results.stage4_backend_startup = { pass: stage4Pass, details: stage4Details };
  console.log('Stage 4 Result:', stage4Pass ? 'PASS' : 'FAIL', stage4Details);

  // ==========================================
  // STAGE 5: EXISTING API SMOKE TEST
  // ==========================================
  console.log('--- STAGE 5: EXISTING API SMOKE TEST ---');
  let stage5Pass = false;
  let stage5Details = {};
  try {
    // 1. GET /pets
    const petsRes = await fetch(`${BASE_URL}/pets?limit=3`);
    const petsData = await petsRes.json();
    const petsOk = petsRes.status === 200 && Array.isArray(petsData.pets || petsData.data?.pets || petsData.data);

    // 2. GET /news
    const newsRes = await fetch(`${BASE_URL}/news?limit=3`);
    const newsData = await newsRes.json();
    const newsOk = newsRes.status === 200 && (Array.isArray(newsData.news || newsData.data?.news || newsData.data) || newsData.success === true);

    // 3. GET /places/nearby
    const placesRes = await fetch(`${BASE_URL}/places/nearby?lat=10.7769&lng=106.7009`);
    const placesData = await placesRes.json();
    const placesOk = placesRes.status === 200 && placesData.success === true;

    stage5Pass = petsOk && newsOk && placesOk;
    stage5Details = {
      petsEndpoint: { status: petsRes.status, ok: petsOk },
      newsEndpoint: { status: newsRes.status, ok: newsOk },
      placesEndpoint: { status: placesRes.status, ok: placesOk }
    };
  } catch (err) {
    stage5Details = { error: err.message };
  }
  results.stage5_existing_api = { pass: stage5Pass, details: stage5Details };
  console.log('Stage 5 Result:', stage5Pass ? 'PASS' : 'FAIL', stage5Details);

  // ==========================================
  // STAGE 6: BEST MATCH / PETSNAP SMOKE TEST
  // ==========================================
  console.log('--- STAGE 6: BEST MATCH / PETSNAP SMOKE TEST ---');
  let stage6Checks = [];

  // 6.1 Best Match GET /best-matches endpoint
  try {
    const bmRes = await fetch(`${BASE_URL}/best-matches`, {
      headers: { Authorization: `Bearer ${tokenUser29}` }
    });
    const bmData = await bmRes.json();
    const ok = bmRes.status === 200 && bmData.success === true && Array.isArray(bmData.data?.bestMatches);
    stage6Checks.push({
      name: 'GET /api/v1/best-matches',
      pass: ok,
      status: bmRes.status,
      count: bmData.data?.bestMatches?.length || 0
    });
  } catch (err) {
    stage6Checks.push({ name: 'GET /api/v1/best-matches', pass: false, error: err.message });
  }

  // 6.2 Best Match Database Persistence & FK integrity (Transactional with ROLLBACK)
  try {
    await conn.beginTransaction();

    // Insert into best_matches using existing user 29, pet 250, adoption_request 14
    const [bmInsert] = await conn.query(`
      INSERT INTO best_matches (
        user_id, pet_id, adoption_request_id, status, started_at, source
      ) VALUES (?, ?, ?, 'active', NOW(), 'adoption_approved')
    `, [29, 250, 14]);
    const bmId = bmInsert.insertId;

    // Insert into best_match_privacy_settings
    await conn.query(`
      INSERT INTO best_match_privacy_settings (
        best_match_id, profile_visibility, show_duration, show_stories
      ) VALUES (?, 'private', 1, 1)
    `, [bmId]);

    // Insert into best_match_stories
    const [storyInsert] = await conn.query(`
      INSERT INTO best_match_stories (
        best_match_id, author_user_id, content, status
      ) VALUES (?, ?, 'Smoke test story content', 'active')
    `, [bmId, 29]);
    const storyId = storyInsert.insertId;

    // Insert into best_match_story_media
    await conn.query(`
      INSERT INTO best_match_story_media (
        story_id, media_type, media_path, display_order
      ) VALUES (?, 'image', 'https://example.com/test.jpg', 0)
    `, [storyId]);

    // Query back to verify JOIN and read operations
    const [readRows] = await conn.query(`
      SELECT
        bm.id, bm.status, ps.profile_visibility, s.content, m.media_path
      FROM best_matches bm
      JOIN best_match_privacy_settings ps ON bm.id = ps.best_match_id
      LEFT JOIN best_match_stories s ON bm.id = s.best_match_id
      LEFT JOIN best_match_story_media m ON s.id = m.story_id
      WHERE bm.id = ?
    `, [bmId]);

    const readOk = readRows.length > 0 && readRows[0].content === 'Smoke test story content';

    // ROLLBACK to maintain zero persistent test artifacts
    await conn.rollback();

    // Verify table is empty after rollback
    const [[postCount]] = await conn.query('SELECT COUNT(*) as cnt FROM best_matches');
    const rolledBackCleanly = postCount.cnt === 0;

    stage6Checks.push({
      name: 'Best Match DB Transactional Write/Read/FK & Rollback',
      pass: readOk && rolledBackCleanly,
      details: { readOk, rolledBackCleanly, residualRows: postCount.cnt }
    });
  } catch (err) {
    await conn.rollback();
    stage6Checks.push({
      name: 'Best Match DB Transactional Write/Read/FK & Rollback',
      pass: false,
      error: err.message
    });
  }

  // 6.3 PetSnap GET /pet-snap recommendation endpoint
  try {
    const snapRes = await fetch(`${BASE_URL}/pet-snap`, {
      headers: { Authorization: `Bearer ${tokenUser3}` }
    });
    const snapData = await snapRes.json();
    const ok = snapRes.status === 200 && snapData.success === true && (snapData.data?.pet !== undefined || Array.isArray(snapData.data?.pets));
    stage6Checks.push({
      name: 'GET /api/v1/pet-snap',
      pass: ok,
      status: snapRes.status,
      candidatePetId: snapData.data?.pet?.id || null
    });
  } catch (err) {
    stage6Checks.push({ name: 'GET /api/v1/pet-snap', pass: false, error: err.message });
  }

  // 6.4 PetSnap GET /pet-snap/liked-pets endpoint
  try {
    const likedRes = await fetch(`${BASE_URL}/pet-snap/liked-pets`, {
      headers: { Authorization: `Bearer ${tokenUser3}` }
    });
    const likedData = await likedRes.json();
    const ok = likedRes.status === 200 && likedData.success === true;
    stage6Checks.push({ name: 'GET /api/v1/pet-snap/liked-pets', pass: ok, status: likedRes.status });
  } catch (err) {
    stage6Checks.push({ name: 'GET /api/v1/pet-snap/liked-pets', pass: false, error: err.message });
  }

  // 6.5 PetSnap Telemetry Write & Read via GET /pet-snap/:id/detail-view
  try {
    const testPetId = 2; // sashimi
    const detailRes = await fetch(`${BASE_URL}/pet-snap/${testPetId}/detail-view`, {
      headers: { Authorization: `Bearer ${tokenUser3}` }
    });
    const detailData = await detailRes.json();

    // Verify in database that pet_interactions recorded this interaction
    const [rows] = await conn.query(`
      SELECT id, user_id, pet_id, interaction_type
      FROM pet_interactions
      WHERE user_id = 3 AND pet_id = ? AND interaction_type = 'detail_view'
    `, [testPetId]);

    const recordedInDb = rows.length > 0;

    // Immediately clean up all test rows for user 3
    await conn.query(`
      DELETE FROM pet_interactions
      WHERE user_id = 3
    `);

    // Verify 0 residual rows
    const [[afterDelete]] = await conn.query(`
      SELECT COUNT(*) as count FROM pet_interactions WHERE user_id = 3
    `);

    const cleanedUp = afterDelete.count === 0;

    const ok = detailRes.status === 200 && detailData.success === true && recordedInDb && cleanedUp;
    stage6Checks.push({
      name: 'GET /api/v1/pet-snap/:id/detail-view Telemetry Write & Clean',
      pass: ok,
      details: {
        httpStatus: detailRes.status,
        recordedInDb,
        cleanedUp,
        residualRows: afterDelete.count
      }
    });
  } catch (err) {
    stage6Checks.push({
      name: 'GET /api/v1/pet-snap/:id/detail-view Telemetry Write & Clean',
      pass: false,
      error: err.message
    });
  }

  await conn.end();

  const stage6Pass = stage6Checks.every(c => c.pass);
  results.stage6_best_match_petsnap = {
    pass: stage6Pass,
    checks: stage6Checks
  };
  console.log('Stage 6 Result:', stage6Pass ? 'PASS' : 'FAIL');
  for (const c of stage6Checks) {
    console.log(`  - [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  }

  fs.writeFileSync(path.join(__dirname, 'stage456_results.json'), JSON.stringify(results, null, 2));
  console.log('Stages 4, 5, 6 verification saved.');
}

runStages456().catch(err => {
  console.error('Stage 4, 5, 6 failed:', err);
  process.exit(1);
});
