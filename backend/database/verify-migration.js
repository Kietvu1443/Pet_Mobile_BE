require("dotenv").config();
const { pool } = require("../config/db");

(async () => {
  const [[r1]] = await pool.execute("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'user_connections'", [process.env.DB_NAME]);
  const [[r2]] = await pool.execute("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'user_passkeys'", [process.env.DB_NAME]);
  const [[r3]] = await pool.execute("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name = 'password'", [process.env.DB_NAME]);
  console.log("user_connections:", r1.cnt > 0 ? "✅ EXISTS" : "❌ NOT FOUND");
  console.log("user_passkeys:", r2.cnt > 0 ? "✅ EXISTS" : "❌ NOT FOUND");
  console.log("users.password nullable:", r3 ? (r3.IS_NULLABLE === "YES" ? "✅ YES" : "❌ NO") : "❌ NOT FOUND");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
