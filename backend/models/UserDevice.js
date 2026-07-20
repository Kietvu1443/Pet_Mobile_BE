const { pool } = require("../config/db");

const UserDevice = {
  async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM user_devices WHERE user_id = ?",
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding user devices:", error);
      throw error;
    }
  },

  async register(userId, pushToken, devicePlatform) {
    try {
      const [result] = await pool.execute(
        "INSERT INTO user_devices (user_id, push_token, device_platform) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), device_platform = VALUES(device_platform), last_active_at = CURRENT_TIMESTAMP",
        [userId, pushToken, devicePlatform],
      );
      return { id: result.insertId, user_id: userId, push_token: pushToken, device_platform: devicePlatform };
    } catch (error) {
      console.error("Error registering device:", error);
      throw error;
    }
  },

  async unregister(pushToken) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM user_devices WHERE push_token = ?",
        [pushToken],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error unregistering device:", error);
      throw error;
    }
  },

  async unregisterAllForUser(userId) {
    try {
      await pool.execute(
        "DELETE FROM user_devices WHERE user_id = ?",
        [userId],
      );
    } catch (error) {
      console.error("Error unregistering all user devices:", error);
      throw error;
    }
  },
};

module.exports = UserDevice;
