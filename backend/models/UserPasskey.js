const { pool } = require("../config/db");

const UserPasskey = {
  // Tìm passkey theo credential_id (dùng khi login)
  async findByCredentialId(credentialId) {
    const [rows] = await pool.execute(
      "SELECT * FROM user_passkeys WHERE credential_id = ?",
      [credentialId]
    );
    return rows[0] || null;
  },

  // Lấy tất cả passkey của một user
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      "SELECT id, credential_id, device_type, backed_up, transports, label, created_at FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  },

  // Lấy danh sách credential_id để loại trừ khi đăng ký mới
  async getCredentialIdsForUser(userId) {
    const [rows] = await pool.execute(
      "SELECT credential_id FROM user_passkeys WHERE user_id = ?",
      [userId]
    );
    return rows.map((r) => r.credential_id);
  },

  // Lưu passkey mới sau khi đăng ký
  async create({ userId, credentialId, publicKey, counter, deviceType, backedUp, transports, label }) {
    const [result] = await pool.execute(
      `INSERT INTO user_passkeys 
       (user_id, credential_id, public_key, counter, device_type, backed_up, transports, label) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        credentialId,
        publicKey,
        counter,
        deviceType || null,
        backedUp ? 1 : 0,
        transports ? JSON.stringify(transports) : null,
        label || null,
      ]
    );
    return result.insertId;
  },

  // Cập nhật counter sau mỗi lần đăng nhập (ngăn chặn clone key)
  async updateCounter(id, newCounter) {
    await pool.execute("UPDATE user_passkeys SET counter = ? WHERE id = ?", [
      newCounter,
      id,
    ]);
  },

  // Đổi tên nhãn thiết bị
  async updateLabel(id, userId, label) {
    const [result] = await pool.execute(
      "UPDATE user_passkeys SET label = ? WHERE id = ? AND user_id = ?",
      [label, id, userId]
    );
    return result.affectedRows > 0;
  },

  // Xóa passkey theo id (phải thuộc user hiện tại)
  async deleteById(id, userId) {
    const [result] = await pool.execute(
      "DELETE FROM user_passkeys WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  // Đếm số passkey của user (dùng để kiểm tra lockout)
  async countByUserId(userId) {
    const [[{ count }]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM user_passkeys WHERE user_id = ?",
      [userId]
    );
    return Number(count);
  },
};

module.exports = UserPasskey;
