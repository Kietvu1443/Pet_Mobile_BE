const { pool } = require("../config/db");

const PetScan = {
  async create(data) {
    try {
      const { user_id, pet_id, referrer, device_platform, scan_location_lat, scan_location_lng } = data;
      const [result] = await pool.execute(
        `INSERT INTO pet_scans (user_id, pet_id, referrer, device_platform, scan_location_lat, scan_location_lng)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id || null, pet_id, referrer || "collar_qr", device_platform || null, scan_location_lat || null, scan_location_lng || null],
      );
      return { id: result.insertId, ...data };
    } catch (error) {
      console.error("Error recording pet scan:", error);
      throw error;
    }
  },

  async countByPet(petId, days) {
    try {
      const whereClause = days ? "WHERE pet_id = ? AND scanned_at >= NOW() - INTERVAL ? DAY" : "WHERE pet_id = ?";
      const params = days ? [petId, days] : [petId];
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM pet_scans ${whereClause}`,
        params,
      );
      return rows[0].total;
    } catch (error) {
      console.error("Error counting pet scans:", error);
      throw error;
    }
  },

  async countByUser(userId, days) {
    try {
      const whereClause = days ? "WHERE user_id = ? AND scanned_at >= NOW() - INTERVAL ? DAY" : "WHERE user_id = ?";
      const params = days ? [userId, days] : [userId];
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM pet_scans ${whereClause}`,
        params,
      );
      return rows[0].total;
    } catch (error) {
      console.error("Error counting user scans:", error);
      throw error;
    }
  },
};

module.exports = PetScan;
