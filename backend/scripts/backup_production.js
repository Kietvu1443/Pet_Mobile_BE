const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runBackup() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT || 3306;
  const dbName = 'pet_helper';

  // 1. Prepare backup directory and filename
  const backupDir = path.join(__dirname, '..', 'database', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `pet_helper_backup_${timestamp}.sql`;
  const backupPath = path.join(backupDir, filename);

  console.log(`Starting backup for database "${dbName}"...`);
  console.log(`Target file: ${backupPath}`);

  // 2. Locate mysqldump
  const mysqldumpExe = 'C:\\Program Files\\MySQL\\MySQL Server 9.7\\bin\\mysqldump.exe';
  if (!fs.existsSync(mysqldumpExe)) {
    throw new Error(`mysqldump not found at: ${mysqldumpExe}`);
  }

  // 3. Execute mysqldump
  const passArg = password ? `--password="${password}"` : '';
  const cmd = `"${mysqldumpExe}" --host="${host}" --port=${port} --user="${user}" ${passArg} --default-character-set=utf8mb4 --single-transaction --routines --triggers --databases ${dbName} --result-file="${backupPath}"`;

  execSync(cmd, { stdio: 'inherit' });

  // 4. Verify backup file
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file does not exist: ${backupPath}`);
  }

  const stats = fs.statSync(backupPath);
  console.log(`Backup completed successfully. Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);

  // 5. Compute SHA-256
  const fileBuffer = fs.readFileSync(backupPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const sha256 = hashSum.digest('hex');

  // 6. Inspect content
  const content = fileBuffer.toString('utf8');
  const createTableMatches = content.match(/CREATE TABLE `?([a-zA-Z0-9_]+)`?/gi) || [];
  const tableNames = createTableMatches.map(m => m.replace(/CREATE TABLE `?/i, '').replace(/`/g, '').trim());
  const insertMatches = content.match(/INSERT INTO `?([a-zA-Z0-9_]+)`?/gi) || [];

  console.log(`Tables found in backup (${tableNames.length}):`, tableNames);
  console.log(`INSERT INTO statements found: ${insertMatches.length}`);

  // 7. Verify production DB tables count after backup
  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database: dbName
  });
  const [prodTables] = await conn.query('SHOW TABLES');
  const prodTableNames = prodTables.map(r => Object.values(r)[0]);
  await conn.end();

  console.log(`Production DB tables count after backup: ${prodTableNames.length}`);

  const report = {
    backupPath,
    filename,
    fileSizeBytes: stats.size,
    fileSizeKB: (stats.size / 1024).toFixed(2) + ' KB',
    tableCountInBackup: tableNames.length,
    tableNames,
    insertCountInBackup: insertMatches.length,
    sha256,
    prodTableCountAfterBackup: prodTableNames.length
  };

  fs.writeFileSync(path.join(backupDir, `latest_backup_metadata.json`), JSON.stringify(report, null, 2));
  console.log('REPORT_JSON:' + JSON.stringify(report));
}

runBackup().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});
