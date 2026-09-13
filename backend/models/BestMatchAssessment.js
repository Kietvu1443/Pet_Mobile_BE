const { pool } = require("../config/db");

/**
 * BestMatchAssessment.js
 * Snapshots produced by BestMatchAssessmentService. History is kept
 * (never overwritten) so the journey's descriptive state over time can
 * be shown later if useful.
 */
const BestMatchAssessment = {
  async createSnapshot({ bestMatchId, level, explanation, factors, modelVersion }) {
    const [result] = await pool.execute(
      `INSERT INTO best_match_assessments
        (best_match_id, assessment_level, explanation, factors, model_version)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bestMatchId,
        level,
        explanation || null,
        factors ? JSON.stringify(factors) : null,
        modelVersion || null,
      ],
    );
    return result.insertId;
  },

  async getLatest(bestMatchId) {
    const [rows] = await pool.execute(
      `SELECT * FROM best_match_assessments
       WHERE best_match_id = ?
       ORDER BY assessed_at DESC
       LIMIT 1`,
      [bestMatchId],
    );
    return rows[0] || null;
  },

  async getHistory(bestMatchId, { limit = 20 } = {}) {
    const [rows] = await pool.execute(
      `SELECT * FROM best_match_assessments
       WHERE best_match_id = ?
       ORDER BY assessed_at DESC
       LIMIT ?`,
      [bestMatchId, String(limit)],
    );
    return rows;
  },
};

module.exports = BestMatchAssessment;
