const { pool } = require("../config/db");

/**
 * BestMatchWellbeingSignal.js
 * Signals, not accusations. Only ever created from an explicit business
 * source (e.g. a formal report, a return workflow, a verified external
 * concern) — never from missing posts, missing media, or inactivity.
 * That rule is enforced by callers (service layer); this model just
 * stores whatever it is given.
 */
const BestMatchWellbeingSignal = {
  async create(
    { bestMatchId, signalType, severity = "info", description, sourceType = null, sourceId = null, metadata = null },
    conn = pool,
  ) {
    const [result] = await conn.execute(
      `INSERT INTO best_match_wellbeing_signals
        (best_match_id, signal_type, severity, description, source_type, source_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        bestMatchId,
        signalType,
        severity,
        description,
        sourceType,
        sourceId,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return result.insertId;
  },

  async list(bestMatchId, { status } = {}) {
    const params = [bestMatchId];
    let statusClause = "";
    if (status) {
      statusClause = "AND status = ?";
      params.push(status);
    }
    const [rows] = await pool.execute(
      `SELECT * FROM best_match_wellbeing_signals
       WHERE best_match_id = ? ${statusClause}
       ORDER BY created_at DESC`,
      params,
    );
    return rows;
  },

  async getById(id) {
    const [rows] = await pool.execute(
      "SELECT * FROM best_match_wellbeing_signals WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] || null;
  },

  async updateStatus(id, { status, reviewedBy, resolutionNotes }) {
    await pool.execute(
      `UPDATE best_match_wellbeing_signals
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), resolution_notes = ?
       WHERE id = ?`,
      [status, reviewedBy || null, resolutionNotes || null, id],
    );
    return this.getById(id);
  },
};

module.exports = BestMatchWellbeingSignal;
