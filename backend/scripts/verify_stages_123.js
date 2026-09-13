const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verifyStages123() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT || 3306;
  const dbName = 'pet_helper';

  console.log(`Connecting to ${dbName}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database: dbName });

  const results = {
    stage1_topology: { pass: false, details: {} },
    stage2_structure: { pass: false, details: {} },
    stage3_safety: { pass: false, details: {} }
  };

  // ==========================================
  // STAGE 1: DATABASE TOPOLOGY
  // ==========================================
  console.log('--- STAGE 1: DATABASE TOPOLOGY ---');
  const [tablesResult] = await conn.query('SHOW TABLES');
  const allTables = tablesResult.map(r => Object.values(r)[0]).sort();
  console.log(`Total tables found: ${allTables.length}`);

  const backupMetaPath = path.join(__dirname, '..', 'database', 'backups', 'latest_backup_metadata.json');
  const backupMeta = JSON.parse(fs.readFileSync(backupMetaPath, 'utf8'));
  const original39 = backupMeta.tableNames.sort();

  const missingOriginal = original39.filter(t => !allTables.includes(t));
  console.log(`Original 39 tables missing: ${missingOriginal.length}`);

  const expected8 = [
    'best_match_assessments',
    'best_match_evidence',
    'best_match_privacy_settings',
    'best_match_stories',
    'best_match_story_media',
    'best_match_wellbeing_signals',
    'best_matches',
    'pet_interactions'
  ].sort();

  const newTables = allTables.filter(t => !original39.includes(t)).sort();
  console.log(`New tables found: ${newTables.length}`, newTables);

  const missingExpected8 = expected8.filter(t => !newTables.includes(t));
  const unexpectedTables = newTables.filter(t => !expected8.includes(t));

  const stage1Pass = allTables.length === 47 && missingOriginal.length === 0 && missingExpected8.length === 0 && unexpectedTables.length === 0;
  results.stage1_topology = {
    pass: stage1Pass,
    totalTableCount: allTables.length,
    original39Intact: missingOriginal.length === 0,
    newTablesCount: newTables.length,
    newTables,
    missingExpected8,
    unexpectedTables
  };
  console.log('Stage 1 Result:', stage1Pass ? 'PASS' : 'FAIL');

  // ==========================================
  // STAGE 2: DATABASE STRUCTURE
  // ==========================================
  console.log('--- STAGE 2: DATABASE STRUCTURE ---');
  let stage2Errors = [];
  const tableStructures = {};

  for (const tbl of expected8) {
    // 1. Columns & PK
    const [cols] = await conn.query(`DESCRIBE ${tbl}`);
    const pk = cols.filter(c => c.Key === 'PRI').map(c => c.Field);
    if (pk.length === 0) stage2Errors.push(`${tbl} has no Primary Key`);

    // 2. Engine, Charset & Collation
    const [tableInfo] = await conn.query(`
      SELECT ENGINE, TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [dbName, tbl]);

    const engine = tableInfo[0].ENGINE;
    const collation = tableInfo[0].TABLE_COLLATION;

    if (engine !== 'InnoDB') stage2Errors.push(`${tbl} engine is ${engine}, expected InnoDB`);
    if (collation !== 'utf8mb4_unicode_ci') stage2Errors.push(`${tbl} collation is ${collation}, expected utf8mb4_unicode_ci`);

    // 3. Indexes
    const [indexes] = await conn.query(`SHOW INDEX FROM ${tbl}`);
    const indexNames = [...new Set(indexes.map(i => i.Key_name))];

    // 4. Foreign Keys & ON DELETE
    const [fks] = await conn.query(`
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME,
        rc.DELETE_RULE,
        rc.UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbName, tbl]);

    // Verify all FK references exist
    for (const fk of fks) {
      if (!allTables.includes(fk.REFERENCED_TABLE_NAME)) {
        stage2Errors.push(`${tbl}.${fk.COLUMN_NAME} references non-existent table ${fk.REFERENCED_TABLE_NAME}`);
      }
    }

    tableStructures[tbl] = {
      columnCount: cols.length,
      primaryKey: pk,
      engine,
      collation,
      indexCount: indexNames.length,
      indexNames,
      foreignKeys: fks.map(f => ({
        name: f.CONSTRAINT_NAME,
        column: f.COLUMN_NAME,
        refTable: f.REFERENCED_TABLE_NAME,
        refColumn: f.REFERENCED_COLUMN_NAME,
        onDelete: f.DELETE_RULE
      }))
    };
  }

  const stage2Pass = stage2Errors.length === 0;
  results.stage2_structure = {
    pass: stage2Pass,
    errors: stage2Errors,
    details: tableStructures
  };
  console.log('Stage 2 Result:', stage2Pass ? 'PASS' : 'FAIL', stage2Errors);

  // ==========================================
  // STAGE 3: EXISTING PRODUCTION SAFETY
  // ==========================================
  console.log('--- STAGE 3: EXISTING PRODUCTION SAFETY ---');
  let stage3Errors = [];
  // Verify row counts and critical columns of core production tables
  const coreTables = ['users', 'pets', 'adoption_requests', 'pet_likes', 'user_pets'];
  const coreTableStats = {};

  for (const tbl of coreTables) {
    const [[countResult]] = await conn.query(`SELECT COUNT(*) as count FROM ${tbl}`);
    const [cols] = await conn.query(`DESCRIBE ${tbl}`);
    coreTableStats[tbl] = {
      rowCount: countResult.count,
      columnCount: cols.length,
      columns: cols.map(c => c.Field)
    };
  }

  // Ensure pets table was NOT altered (must NOT have species_id or the 11 phantom columns)
  const petCols = coreTableStats.pets.columns;
  if (petCols.includes('species_id') || petCols.includes('primary_breed_id') || petCols.includes('adoption_status')) {
    stage3Errors.push('CRITICAL: pets table was altered with staging phantom columns!');
  }

  const stage3Pass = stage3Errors.length === 0;
  results.stage3_safety = {
    pass: stage3Pass,
    errors: stage3Errors,
    coreTableStats
  };
  console.log('Stage 3 Result:', stage3Pass ? 'PASS' : 'FAIL', stage3Errors);

  await conn.end();

  fs.writeFileSync(path.join(__dirname, 'stage123_results.json'), JSON.stringify(results, null, 2));
  console.log('Stage 1, 2, 3 verification saved.');
}

verifyStages123().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
