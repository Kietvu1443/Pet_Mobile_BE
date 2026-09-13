/**
 * bestMatchService.js
 *
 * "Đây là bằng chứng cho hành trình chúng ta đã đi cùng nhau."
 *
 * Best Match begins only after official adoption and follows the
 * relationship afterward. It is intentionally separate from the
 * swipe/recommendation domain (pet_likes, pet_interactions,
 * pet_recommendations) — this file must never read from or write to
 * those tables.
 */
const { pool } = require("../config/db");
const BestMatch = require("../models/BestMatch");
const BestMatchPrivacySettings = require("../models/BestMatchPrivacySettings");
const BestMatchEvidence = require("../models/BestMatchEvidence");
const BestMatchStory = require("../models/BestMatchStory");
const BestMatchAssessmentService = require("./BestMatchAssessmentService");
const notificationService = require("./notificationService");
const NOTIF_TYPES = require("../shared/constants/notificationTypes");

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const bestMatchService = {
  /**
   * Hook this at the point in the adoption workflow that truly means
   * "official adoption" — in this codebase that is
   * adoptionRequestService.approveAdoptionRequest, once the request's
   * status is 'approved' and pets.status is 'adopted'.
   *
   * ATOMIC when called with externalConn: this function does no commit/
   * rollback/release of its own in that case — any error it throws must
   * propagate to the caller's transaction so the whole approval rolls
   * back together with Best Match creation. Never creates a Best Match
   * for a swipe/like/superlike/adopt-click/pending request — only for an
   * already-approved one.
   *
   * Idempotent AND resumable — but only ever resumes a journey the USER
   * didn't choose to end:
   *  - if an active Best Match already exists for this adoption request,
   *    it is returned as-is (no-op).
   *  - if a CANCELLED Best Match exists because the adoption itself was
   *    administratively reverted (Task 2 / Case B), re-approving resumes
   *    that same journey record — preserving its original started_at
   *    (Task 3) — instead of leaving it stuck cancelled or creating a
   *    duplicate.
   *  - if a CANCELLED Best Match exists because the USER intentionally
   *    cancelled it (Task 2 / Case A), re-approving the adoption must NOT
   *    resurrect it: the cancelled record is returned as-is and
   *    didActivate stays false, so no "journey started" notification
   *    fires for a journey the user chose to end.
   *  - otherwise a new Best Match is created.
   *
   * Side effects (notification) only fire once the journey is actually
   * committed: when joined to an external transaction, the caller is
   * responsible for notifying after ITS commit succeeds; this function
   * only sends the notification itself when it owns and commits its own
   * transaction.
   *
   * @param {number} adoptionRequestId
   * @param {import('mysql2/promise').PoolConnection} [externalConn] - pass
   *   the caller's transaction connection to create the Best Match as part
   *   of the same transaction; otherwise a new one is opened.
   * @returns {Promise<{bestMatch: object, didActivate: boolean} | null>}
   *   null when the adoption request isn't (yet) approved; otherwise the
   *   current Best Match row plus whether this call newly created/resumed
   *   it (false for a pure idempotent no-op on an already-active journey).
   */
  async ensureBestMatchForOfficialAdoption(adoptionRequestId, externalConn = null) {
    const ownConnection = !externalConn;
    const conn = externalConn || (await pool.getConnection());

    try {
      if (ownConnection) await conn.beginTransaction();

      const [requestRows] = await conn.execute(
        `SELECT id, user_id, pet_id, status, reviewed_at, created_at
         FROM adoption_requests
         WHERE id = ?
         LIMIT 1`,
        [adoptionRequestId],
      );

      if (!requestRows.length) {
        throw createError(404, "Không tìm thấy hồ sơ nhận nuôi");
      }

      const request = requestRows[0];

      // Official adoption == the project's existing 'approved' status.
      // Do not create a Best Match for pending/rejected requests.
      if (request.status !== "approved") {
        return null;
      }

      const startedAt = request.reviewed_at || request.created_at || new Date();
      const existing = await BestMatch.getByAdoptionRequestId(adoptionRequestId, conn);

      let bestMatchId;
      let didActivate = false; // true only when this call newly created or resumed the journey

      if (existing && existing.status === "active") {
        // Pure idempotent no-op — nothing to (re)notify about.
        bestMatchId = existing.id;
      } else if (existing && existing.status === "cancelled") {
        if (BestMatch.isAdoptionRevertedCancellation(existing.cancel_reason)) {
          // Re-approval after an earlier admin revert — resume the same
          // record, original started_at untouched (see BestMatch.reactivate).
          await BestMatch.reactivate(existing.id, conn);
          bestMatchId = existing.id;
          didActivate = true;
        } else {
          // The user intentionally ended this journey (or the reason is
          // unrecognized/legacy). Re-approving the underlying adoption
          // must never automatically resurrect a Best Match the user
          // chose to cancel — leave it cancelled, don't duplicate it.
          bestMatchId = existing.id;
          didActivate = false;
        }
      } else {
        const created = await BestMatch.create(
          {
            userId: request.user_id,
            petId: request.pet_id,
            adoptionRequestId: request.id,
            startedAt,
          },
          conn,
        );
        bestMatchId = created.id;
        didActivate = true;

        await BestMatchPrivacySettings.createDefault(bestMatchId, conn);

        // Initial derived evidence for the relationship's start. This is
        // the permanent evidence a private user can rely on without ever
        // posting.
        const alreadyHasDurationEvidence = await BestMatchEvidence.existsForSource(
          bestMatchId,
          "shared_duration",
          null,
          conn,
        );
        if (!alreadyHasDurationEvidence) {
          await BestMatchEvidence.create(
            {
              bestMatchId,
              evidenceType: "shared_duration",
              sourceType: "shared_duration",
              sourceId: null,
              title: "Chính thức nhận nuôi",
              description: "Hành trình bắt đầu từ ngày nhận nuôi được duyệt chính thức.",
              evidenceDate: startedAt,
              visibility: "private",
            },
            conn,
          );
          await BestMatch.incrementEvidenceCount(bestMatchId, 1, conn);
        }
      }

      if (ownConnection) {
        await conn.commit();
        if (didActivate) {
          notificationService.send({
            userId: request.user_id,
            title: "💛 Hành trình Best Match đã bắt đầu",
            message: "Best Match của bạn đã sẵn sàng — hãy ghé qua khi bạn muốn lưu lại một khoảnh khắc.",
            type: NOTIF_TYPES.BEST_MATCH_STARTED,
            data: { bestMatchId, petId: request.pet_id },
          });
        }
        return { bestMatch: await BestMatch.getById(bestMatchId), didActivate };
      }

      // Joined to the caller's transaction: no commit here, and the
      // notification is the caller's responsibility once ITS commit
      // succeeds. Read the row back through the same connection so the
      // caller sees the just-written (uncommitted-to-others) data.
      return { bestMatch: await BestMatch.getById(bestMatchId, conn), didActivate };
    } catch (error) {
      if (ownConnection) await conn.rollback();
      throw error;
    } finally {
      if (ownConnection) conn.release();
    }
  },

  async getUserBestMatches(userId) {
    return BestMatch.getByUserId(userId, { status: "active" });
  },

  async getBestMatchProfile(bestMatchId, requestingUserId) {
    const bestMatch = await BestMatch.getProfileDetails(bestMatchId);
    if (!bestMatch) {
      throw createError(404, "Không tìm thấy Best Match");
    }

    const isOwner = Number(bestMatch.user_id) === Number(requestingUserId);
    if (!isOwner && bestMatch.profile_visibility !== "public") {
      throw createError(403, "Bạn không có quyền xem hành trình này");
    }

    // Owner always sees everything; non-owners are gated per-toggle. Each
    // toggle is enforced server-side — the response itself omits the
    // gated data rather than relying on the client to hide it.
    const showDuration = isOwner || !!bestMatch.show_duration;
    const showStories = isOwner || !!bestMatch.show_stories;
    const showMedia = isOwner || !!bestMatch.show_media;

    const durationDays = bestMatchService.computeDurationDays(bestMatch);

    let stories = [];
    if (showStories) {
      stories = await BestMatchStory.listByBestMatch(bestMatchId, {
        includePrivate: isOwner,
        publicOnly: !isOwner,
      });
      if (!isOwner && !showMedia) {
        // Stories can be visible while their attached media stays hidden.
        stories = stories.map(({ media, ...rest }) => ({ ...rest, media: [] }));
      }
    }

    const evidence = showMedia
      ? await BestMatchEvidence.listByBestMatch(bestMatchId, { publicOnly: !isOwner })
      : [];

    // The assessment's explanation narrates duration in prose, so it must
    // stay gated behind show_duration too, not just the raw number below.
    const latestAssessment = showDuration
      ? await BestMatchAssessmentService.getLatestOrAssess(bestMatchId)
      : null;

    return {
      bestMatch: {
        id: bestMatch.id,
        status: bestMatch.status,
        started_at: showDuration ? bestMatch.started_at : undefined,
        cancelled_at: isOwner ? bestMatch.cancelled_at : undefined,
        duration_days: showDuration ? durationDays : undefined,
        story_count: showStories ? bestMatch.story_count : undefined,
        evidence_count: showMedia ? bestMatch.evidence_count : undefined,
        pet: {
          id: bestMatch.pet_id,
          name: bestMatch.pet_name,
          pet_type: bestMatch.pet_type,
          breed: bestMatch.breed,
          gender: bestMatch.gender,
          age: bestMatch.age,
          avatar: bestMatch.pet_avatar,
        },
        privacy: isOwner
          ? {
              profile_visibility: bestMatch.profile_visibility,
              show_duration: !!bestMatch.show_duration,
              show_stories: !!bestMatch.show_stories,
              show_media: !!bestMatch.show_media,
              show_ring_badge: !!bestMatch.show_ring_badge,
            }
          : undefined,
      },
      stories,
      evidence,
      assessment: latestAssessment,
      is_owner: isOwner,
    };
  },

  computeDurationDays(bestMatch) {
    const start = new Date(bestMatch.started_at);
    const end = bestMatch.cancelled_at ? new Date(bestMatch.cancelled_at) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  },

  async cancelBestMatch({ bestMatchId, userId, reason }) {
    const owned = await BestMatch.isOwnedByUser(bestMatchId, userId);
    if (!owned) {
      throw createError(403, "Bạn không có quyền huỷ Best Match này");
    }

    // Tagged as a user-initiated cancellation (Task 2 / Case A) so a
    // later re-approval of the adoption never auto-reactivates it — see
    // ensureBestMatchForOfficialAdoption.
    const taggedReason = BestMatch.formatCancelReason(
      BestMatch.CANCEL_REASON.USER_CANCELLED,
      reason,
    );
    const ok = await BestMatch.cancel({ bestMatchId, reason: taggedReason });
    if (!ok) {
      throw createError(409, "Best Match không ở trạng thái có thể huỷ");
    }

    notificationService.send({
      userId,
      title: "Best Match đã được huỷ",
      message: "Hành trình vẫn được lưu lại đầy đủ, bạn có thể xem lại bất cứ lúc nào.",
      type: NOTIF_TYPES.BEST_MATCH_CANCELLED,
      data: { bestMatchId },
    });

    return BestMatch.getById(bestMatchId);
  },
};

module.exports = bestMatchService;
