const { pool } = require("../config/db");

/**
 * BestMatchPrivacySettings.js
 * Defaults are private-by-default so a quiet, non-posting user's Best
 * Match is never exposed without them opting in.
 */
const BestMatchPrivacySettings = {
  async getByBestMatchId(bestMatchId, conn = pool) {
    const [rows] = await conn.execute(
      "SELECT * FROM best_match_privacy_settings WHERE best_match_id = ? LIMIT 1",
      [bestMatchId],
    );
    return rows[0] || null;
  },

  async createDefault(bestMatchId, conn = pool) {
    await conn.execute(
      `INSERT INTO best_match_privacy_settings (best_match_id)
       VALUES (?)
       ON DUPLICATE KEY UPDATE id = id`,
      [bestMatchId],
    );
    return this.getByBestMatchId(bestMatchId, conn);
  },

  async update(bestMatchId, fields) {
    const allowed = [
      "profile_visibility",
      "show_duration",
      "show_stories",
      "show_media",
      "show_ring_badge",
    ];
    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }

    if (!sets.length) {
      return this.getByBestMatchId(bestMatchId);
    }

    params.push(bestMatchId);
    await pool.execute(
      `UPDATE best_match_privacy_settings SET ${sets.join(", ")} WHERE best_match_id = ?`,
      params,
    );
    return this.getByBestMatchId(bestMatchId);
  },
};

module.exports = BestMatchPrivacySettings;
