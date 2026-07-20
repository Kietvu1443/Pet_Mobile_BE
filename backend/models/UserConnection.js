const { pool } = require("../config/db");

const UserConnection = {
  // Tìm liên kết theo provider + provider_id
  async findByProvider(provider, providerId) {
    const [rows] = await pool.execute(
      "SELECT uc.*, u.id as user_id, u.display_name, u.name, u.email, u.role, u.verify, u.status, u.password FROM user_connections uc JOIN users u ON uc.user_id = u.id WHERE uc.provider = ? AND uc.provider_id = ?",
      [provider, providerId]
    );
    return rows[0] || null;
  },

  // Lấy danh sách liên kết của một user
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      "SELECT id, provider, linked_email, created_at FROM user_connections WHERE user_id = ? ORDER BY created_at ASC",
      [userId]
    );
    return rows;
  },

  // Thêm liên kết mới
  async create(userId, provider, providerId, linkedEmail) {
    const [result] = await pool.execute(
      "INSERT INTO user_connections (user_id, provider, provider_id, linked_email) VALUES (?, ?, ?, ?)",
      [userId, provider, providerId, linkedEmail || null]
    );
    return result.insertId;
  },

  // Xóa liên kết (unlink)
  async deleteByUserAndProvider(userId, provider) {
    const [result] = await pool.execute(
      "DELETE FROM user_connections WHERE user_id = ? AND provider = ?",
      [userId, provider]
    );
    return result.affectedRows > 0;
  },

  // Đếm số phương thức đăng nhập còn lại (để kiểm tra lockout)
  // Trả về: { hasPassword, connectionCount, passkeyCount }
  async countLoginMethods(userId) {
    const [[userRow]] = await pool.execute(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );
    const hasPassword = userRow && userRow.password !== null;

    const [[{ connectionCount }]] = await pool.execute(
      "SELECT COUNT(*) AS connectionCount FROM user_connections WHERE user_id = ?",
      [userId]
    );

    const [[{ passkeyCount }]] = await pool.execute(
      "SELECT COUNT(*) AS passkeyCount FROM user_passkeys WHERE user_id = ?",
      [userId]
    );

    return {
      hasPassword,
      connectionCount: Number(connectionCount),
      passkeyCount: Number(passkeyCount),
    };
  },
};

module.exports = UserConnection;
