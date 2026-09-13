const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function auditQRPets() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'pet_helper'
  });

  console.log('=== PETS TABLE AUDIT ===');
  const [petsSample] = await conn.query('SELECT id, pet_code, name, status FROM pets LIMIT 5');
  console.log('Sample pets:', petsSample);

  const [[petCount]] = await conn.query('SELECT COUNT(*) as total FROM pets');
  const [[nullCodeCount]] = await conn.query("SELECT COUNT(*) as total FROM pets WHERE pet_code IS NULL OR pet_code = ''");
  console.log(`Total pets: ${petCount.total}, with empty pet_code: ${nullCodeCount.total}`);

  console.log('\n=== USER_PETS TABLE AUDIT ===');
  const [userPetsSample] = await conn.query('SELECT id, user_id, name, species, breed FROM user_pets LIMIT 5');
  console.log('Sample user_pets:', userPetsSample);

  const [[userPetCount]] = await conn.query('SELECT COUNT(*) as total FROM user_pets');
  console.log(`Total user_pets: ${userPetCount.total}`);

  console.log('\n=== PET_SCANS TABLE AUDIT ===');
  // Does pet_scans table exist?
  const [tables] = await conn.query("SHOW TABLES LIKE 'pet_scans'");
  if (tables.length > 0) {
    const [scansCols] = await conn.query('DESCRIBE pet_scans');
    console.log('pet_scans columns:', scansCols.map(c => `${c.Field} (${c.Type})`));
    const [scansSample] = await conn.query('SELECT * FROM pet_scans LIMIT 5');
    console.log('Sample pet_scans rows:', scansSample);
  } else {
    console.log('pet_scans table does NOT exist');
  }

  await conn.end();
}

auditQRPets().catch(console.error);
