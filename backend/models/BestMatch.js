const { pool } = require("../config/db");

/**
 * BestMatch.js
 * Data access for the `best_matches` table — the ongoing relationship
 * between an officially adopted pet and its adopter.
 *
 * Best Match is NOT the swipe/recommendation domain. It never reads from
 * or writes to pet_likes / pet_interactions / pet_recommendations.
 */
/**
 * Best Match can end up 'cancelled' for two lifecycle-distinct reasons
 * (see Task 2): the user intentionally ending their journey, or the
 * underlying adoption being administratively reverted. Both still use the
 * existing status/cancel_reason columns — no schema change — but the
 * reason string now carries a stable machine-readable prefix so a later
 * re-approval can tell them apart before deciding whether to resume the
 * journey.
 */
const CANCEL_REASON = {
  USER_CANCELLED: "USER_CANCELLED",
  ADOPTION_REVERTED: "ADOPTION_REVERTED",
};

const BestMatch = {
  CANCEL_REASON,

  // Builds the stored cancel_reason value: "<CODE>" or "<CODE>: <detail>".
  formatCancelReason(code, detail) {
    const trimmedDetail = detail ? String(detail).trim() : "";
    return trimmedDetail ? `${code}: ${trimmedDetail}` : code;
  },

  // Recovers the machine-readable code from a stored cancel_reason value.
  // Returns null for empty/legacy values that don't carry a known code —
  // callers should treat that as "unknown, do not auto-reactivate".
  getCancelReasonCode(cancelReason) {
    if (!cancelReason) return null;
    const str = String(cancelReason);
    const separatorIndex = str.indexOf(":");
    const rawCode = separatorIndex === -1 ? str : str.slice(0, separatorIndex);
    const code = rawCode.trim();
    return Object.values(CANCEL_REASON).includes(code) ? code : null;
  },

  isAdoptionRevertedCancellation(cancelReason) {
    return this.getCancelReasonCode(cancelReason) === CANCEL_REASON.ADOPTION_REVERTED;
  },

  isUserCancellation(cancelReason) {
    return this.getCancelReasonCode(cancelReason) === CANCEL_REASON.USER_CANCELLED;
  },

  async getById(id, conn = pool) {
    const [rows] = await conn.execute(
      "SELECT * FROM best_matches WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] || null;
  },

  async getByAdoptionRequestId(adoptionRequestId, conn = pool) {
    const [rows] = await conn.execute(
      "SELECT * FROM best_matches WHERE adoption_request_id = ? LIMIT 1",
      [adoptionRequestId],
    );
    return rows[0] || null;
  },

  // Active Best Matches for a user (used for the profile badge + pet list).
  // Joins the existing privacy settings table so each summary carries
  // show_ring_badge — the frontend decides whether to render the ring
  // badge (it may show it if ANY active Best Match allows it); this query
  // only needs to expose the existing per-Best-Match value correctly.
  async getByUserId(userId, { status = "active" } = {}) {
    const params = [userId];
    let statusClause = "";
    if (status) {
      statusClause = "AND bm.status = ?";
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT
        bm.*,
        p.name AS pet_name,
        p.pet_type,
        pi.image_path AS pet_avatar,
        pps.show_ring_badge
      FROM best_matches bm
      INNER JOIN pets p ON p.id = bm.pet_id
      LEFT JOIN pet_images pi ON pi.pet_id = p.id AND pi.display_order = 0
      LEFT JOIN best_match_privacy_settings pps ON pps.best_match_id = bm.id
      WHERE bm.user_id = ? ${statusClause}
      ORDER BY bm.started_at DESC`,
      params,
    );
    return rows.map((r) => ({ ...r, show_ring_badge: !!r.show_ring_badge }));
  },

  /**
   * Idempotent creation. Relies on the UNIQUE KEY on adoption_request_id:
   * if a Best Match already exists for this adoption request, this is a
   * no-op and the existing row is returned. Callers should still wrap this
   * with an ensure-style service function.
   */
  async create({ userId, petId, adoptionRequestId, startedAt }, conn = pool) {
    await conn.execute(
      `INSERT INTO best_matches (user_id, pet_id, adoption_request_id, status, started_at)
       VALUES (?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [userId, petId, adoptionRequestId, startedAt],
    );
    return this.getByAdoptionRequestId(adoptionRequestId, conn);
  },

  async cancel({ bestMatchId, reason }, conn = pool) {
    const [result] = await conn.execute(
      `UPDATE best_matches
       SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ?
       WHERE id = ? AND status = 'active'`,
      [reason || null, bestMatchId],
    );
    return result.affectedRows > 0;
  },

  /**
   * Resumes a previously-cancelled Best Match (e.g. an approval that was
   * reverted and is now being approved again). Reuses the existing
   * active/cancelled lifecycle instead of inventing a new status —
   * cancellation is never permanent deletion, so re-approval can safely
   * resume the same journey record.
   *
   * Deliberately does NOT touch started_at: the original journey start
   * must stay historically correct across a revert → re-approve cycle, or
   * duration/timeline for any existing stories/evidence would be thrown
   * off. Only lifecycle/cancellation fields and last_activity_at change.
   *
   * Callers are responsible for only invoking this for an
   * ADOPTION_REVERTED cancellation (see isAdoptionRevertedCancellation) —
   * a user-cancelled journey must never be resumed this way.
   */
  async reactivate(bestMatchId, conn = pool) {
    const [result] = await conn.execute(
      `UPDATE best_matches
       SET status = 'active', cancelled_at = NULL, cancel_reason = NULL,
           last_activity_at = NOW()
       WHERE id = ? AND status = 'cancelled'`,
      [bestMatchId],
    );
    return result.affectedRows > 0;
  },

  async touchActivity(bestMatchId, conn = pool) {
    await conn.execute(
      "UPDATE best_matches SET last_activity_at = NOW() WHERE id = ?",
      [bestMatchId],
    );
  },

  async registerStoryCreated(bestMatchId, conn = pool) {
    await conn.execute(
      `UPDATE best_matches
       SET story_count = story_count + 1,
           last_story_at = NOW(),
           last_activity_at = NOW()
       WHERE id = ?`,
      [bestMatchId],
    );
  },

  async registerStoryDeleted(bestMatchId, conn = pool) {
    await conn.execute(
      `UPDATE best_matches
       SET story_count = GREATEST(story_count - 1, 0),
           last_activity_at = NOW()
       WHERE id = ?`,
      [bestMatchId],
    );
  },

  async incrementEvidenceCount(bestMatchId, byAmount = 1, conn = pool) {
    await conn.execute(
      `UPDATE best_matches
       SET evidence_count = evidence_count + ?,
           last_activity_at = NOW()
       WHERE id = ?`,
      [byAmount, bestMatchId],
    );
  },

  async decrementEvidenceCount(bestMatchId, byAmount = 1, conn = pool) {
    await conn.execute(
      `UPDATE best_matches
       SET evidence_count = GREATEST(evidence_count - ?, 0)
       WHERE id = ?`,
      [byAmount, bestMatchId],
    );
  },

  // Ownership check helper — never trust a bestMatchId alone.
  async isOwnedByUser(bestMatchId, userId) {
    const [rows] = await pool.execute(
      "SELECT id FROM best_matches WHERE id = ? AND user_id = ? LIMIT 1",
      [bestMatchId, userId],
    );
    return rows.length > 0;
  },

  // Full profile: pet identity + duration + privacy. Stories/evidence/
  // assessment are assembled by the service layer from their own models.
  async getProfileDetails(bestMatchId) {
    const [rows] = await pool.execute(
      `SELECT
        bm.*,
        p.name AS pet_name,
        p.pet_type,
        p.breed,
        p.gender,
        p.age,
        pi.image_path AS pet_avatar,
        pps.profile_visibility,
        pps.show_duration,
        pps.show_stories,
        pps.show_media,
        pps.show_ring_badge
      FROM best_matches bm
      INNER JOIN pets p ON p.id = bm.pet_id
      LEFT JOIN pet_images pi ON pi.pet_id = p.id AND pi.display_order = 0
      LEFT JOIN best_match_privacy_settings pps ON pps.best_match_id = bm.id
      WHERE bm.id = ?
      LIMIT 1`,
      [bestMatchId],
    );
    return rows[0] || null;
  },
};

module.exports = BestMatch;
