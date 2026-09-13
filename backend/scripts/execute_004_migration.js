const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function executeMigration() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT || 3306;
  const dbName = 'pet_helper';

  console.log(`Connecting to database "${dbName}"...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: dbName,
    multipleStatements: true
  });

  // 1. Check pre-migration count
  const [preTables] = await conn.query('SHOW TABLES');
  const preTableNames = preTables.map(r => Object.values(r)[0]).sort();
  console.log(`Pre-migration table count: ${preTableNames.length}`);
  if (preTableNames.length !== 39) {
    throw new Error(`Expected 39 tables in ${dbName}, found ${preTableNames.length}`);
  }

  // 2. Read migration SQL
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '004_production_bestmatch_petsnap.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`Executing migration file: ${migrationPath}`);
  const startTime = Date.now();
  await conn.query(migrationSql);
  const elapsedMs = Date.now() - startTime;
  console.log(`Migration executed successfully in ${elapsedMs}ms.`);

  // 3. Check post-migration count
  const [postTables] = await conn.query('SHOW TABLES');
  const postTableNames = postTables.map(r => Object.values(r)[0]).sort();
  console.log(`Post-migration table count: ${postTableNames.length}`);

  const newTables = postTableNames.filter(t => !preTableNames.includes(t));
  console.log(`New tables created (${newTables.length}):`, newTables);

  // 4. Verify the 8 expected tables
  const expected8 = [
    'best_match_assessments',
    'best_match_evidence',
    'best_match_privacy_settings',
    'best_match_stories',
    'best_match_story_media',
    'best_match_wellbeing_signals',
    'best_matches',
    'pet_interactions'
  ];

  const missing = expected8.filter(t => !newTables.includes(t));
  const unexpected = newTables.filter(t => !expected8.includes(t));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Table mismatch! Missing: ${JSON.stringify(missing)}, Unexpected: ${JSON.stringify(unexpected)}`);
  }

  // 5. Inspect FKs and indexes for all 8 new tables
  const details = {};
  for (const tbl of expected8) {
    const [cols] = await conn.query(`DESCRIBE ${tbl}`);
    const [indexes] = await conn.query(`SHOW INDEX FROM ${tbl}`);
    const [fks] = await conn.query(`
      SELECT
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbName, tbl]);

    details[tbl] = {
      columnCount: cols.length,
      columns: cols.map(c => `${c.Field} (${c.Type}, Null: ${c.Null}, Key: ${c.Key})`),
      indexes: indexes.map(i => `${i.Key_name} on ${i.Column_name} (unique: ${i.Non_unique === 0})`),
      foreignKeys: fks.map(f => `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`)
    };
  }

  await conn.end();

  const report = {
    targetDatabase: dbName,
    preTableCount: preTableNames.length,
    postTableCount: postTableNames.length,
    elapsedMs,
    newTables,
    tableDetails: details
  };

  const reportPath = path.join(__dirname, '..', 'database', 'backups', 'migration_004_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('=== MIGRATION 004 COMPLETED SUCCESSFULLY ===');
  console.log(JSON.stringify(report, null, 2));
}

executeMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
