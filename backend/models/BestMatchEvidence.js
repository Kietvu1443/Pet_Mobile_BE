const { pool } = require("../config/db");

/**
 * BestMatchEvidence.js
 * Meaningful evidence that is voluntarily created or safely derived from
 * existing relationship activity — never something the user is required
 * to submit.
 *
 * source_type examples: shared_duration | story | story_media | qr_scan | other
 */
const BestMatchEvidence = {
  async create(
    {
      bestMatchId,
      evidenceType,
      sourceType,
      sourceId = null,
      title,
      description = null,
      evidenceDate = null,
      visibility = "private",
      metadata = null,
    },
    conn = pool,
  ) {
    const [result] = await conn.execute(
      `INSERT INTO best_match_evidence
        (best_match_id, evidence_type, source_type, source_id, title, description,
         evidence_date, visibility, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bestMatchId,
        evidenceType,
        sourceType,
        sourceId,
        title,
        description,
        evidenceDate,
        visibility,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return result.insertId;
  },

  // Guards against re-deriving the same evidence (e.g. re-running the
  // adoption hook, or editing a story should never double-count it).
  async existsForSource(bestMatchId, sourceType, sourceId, conn = pool) {
    const [rows] = await conn.execute(
      `SELECT id FROM best_match_evidence
       WHERE best_match_id = ? AND source_type = ? AND source_id <=> ?
       LIMIT 1`,
      [bestMatchId, sourceType, sourceId],
    );
    return rows.length > 0;
  },

  async listByBestMatch(bestMatchId, { publicOnly = false } = {}) {
    const visibilityClause = publicOnly ? "AND visibility = 'public'" : "";
    const [rows] = await pool.execute(
      `SELECT * FROM best_match_evidence
       WHERE best_match_id = ? ${visibilityClause}
       ORDER BY evidence_date DESC, created_at DESC`,
      [bestMatchId],
    );
    return rows;
  },

  async countByBestMatch(bestMatchId) {
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM best_match_evidence WHERE best_match_id = ?",
      [bestMatchId],
    );
    return total;
  },

  async deleteBySource(bestMatchId, sourceType, sourceId, conn = pool) {
    const [result] = await conn.execute(
      "DELETE FROM best_match_evidence WHERE best_match_id = ? AND source_type = ? AND source_id <=> ?",
      [bestMatchId, sourceType, sourceId],
    );
    return result.affectedRows;
  },
};

module.exports = BestMatchEvidence;
