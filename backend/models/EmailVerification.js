const { pool } = require("../config/db");

const EmailVerification = {
  /**
   * Save a new OTP for a user
   */
  async saveOtp(userId, otp, expiresAt) {
    const [result] = await pool.execute(
      `INSERT INTO email_verifications (user_id, otp, expires_at) VALUES (?, ?, ?)`,
      [userId, otp, expiresAt]
    );
    return result;
  },

  /**
   * Find the latest valid (non-expired) OTP for a user
   */
  async findValidOtp(userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM email_verifications 
       WHERE user_id = ? AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Increment the attempts counter for a specific OTP record
   */
  async incrementAttempts(id) {
    await pool.execute(
      `UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?`,
      [id]
    );
  },

  /**
   * Delete all OTPs for a specific user
   */
  async deleteByUserId(userId) {
    await pool.execute(
      `DELETE FROM email_verifications WHERE user_id = ?`,
      [userId]
    );
  },

  /**
   * Count how many OTPs were created in the last N minutes (rate limiting)
   * Default: max 3 in 10 minutes
   */
  async countRecentOtps(userId, withinMinutes = 10) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM email_verifications 
       WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, withinMinutes]
    );
    return rows[0].cnt;
  },

  /**
   * Check cooldown: returns the last OTP's created_at timestamp
   * Returns null if no recent OTP exists
   */
  async getLastOtpTime(userId) {
    const [rows] = await pool.execute(
      `SELECT created_at FROM email_verifications 
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] ? rows[0].created_at : null;
  },

  /**
   * Check if the user must wait before sending another OTP (60s cooldown)
   * Returns { canSend: boolean, waitSeconds: number }
   */
  async checkCooldown(userId, cooldownSeconds = 60) {
    const lastTime = await this.getLastOtpTime(userId);
    if (!lastTime) return { canSend: true, waitSeconds: 0 };

    const now = new Date();
    const lastDate = new Date(lastTime);
    const diffSeconds = Math.floor((now - lastDate) / 1000);

    if (diffSeconds < cooldownSeconds) {
      return {
        canSend: false,
        waitSeconds: cooldownSeconds - diffSeconds,
      };
    }
    return { canSend: true, waitSeconds: 0 };
  },
};

module.exports = EmailVerification;
