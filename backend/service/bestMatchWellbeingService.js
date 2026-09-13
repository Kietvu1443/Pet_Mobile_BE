/**
 * bestMatchWellbeingService.js
 *
 * Supports pet protection WITHOUT surveillance and WITHOUT accusing a
 * user of abuse from silence. A signal may only be recorded when it
 * comes from an explicit business source — never from low story count,
 * no photos, no videos, inactivity, or a private profile.
 *
 * Any serious signal is meant to support human review, not to
 * automatically label a user.
 */
const BestMatch = require("../models/BestMatch");
const BestMatchWellbeingSignal = require("../models/BestMatchWellbeingSignal");

// The only sources this service will accept. Anything not in this list
// (in particular "inactivity", "no_stories", "low_evidence", "private_profile")
// is rejected outright — see createSignal below.
const ALLOWED_SOURCE_TYPES = ["formal_report", "return_workflow", "verified_external_concern", "manual_admin_review"];

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const bestMatchWellbeingService = {
  async createSignal({ bestMatchId, signalType, severity, description, sourceType, sourceId, metadata, createdByRole }) {
    // Only staff/admin (role 0/1) or trusted internal workflows may create
    // a signal — never derived automatically from a user's own inactivity.
    if (![0, 1].includes(createdByRole)) {
      throw createError(403, "Chỉ nhân viên/quản trị viên mới có thể tạo tín hiệu này");
    }

    if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      throw createError(
        400,
        `source_type không hợp lệ. Tín hiệu chỉ được tạo từ nguồn nghiệp vụ rõ ràng: ${ALLOWED_SOURCE_TYPES.join(", ")}`,
      );
    }

    const trimmedDescription = String(description || "").trim();
    if (!trimmedDescription) {
      throw createError(400, "Vui lòng mô tả rõ tín hiệu này dựa trên nguồn nào");
    }

    const bestMatch = await BestMatch.getById(bestMatchId);
    if (!bestMatch) throw createError(404, "Không tìm thấy Best Match");

    const id = await BestMatchWellbeingSignal.create({
      bestMatchId,
      signalType,
      severity: severity || "info",
      description: trimmedDescription,
      sourceType,
      sourceId: sourceId || null,
      metadata: metadata || null,
    });

    return BestMatchWellbeingSignal.getById(id);
  },

  async listSignals({ bestMatchId, status, requestingUserId, requestingUserRole }) {
    const bestMatch = await BestMatch.getById(bestMatchId);
    if (!bestMatch) throw createError(404, "Không tìm thấy Best Match");

    const isOwner = Number(bestMatch.user_id) === Number(requestingUserId);
    const isStaff = [0, 1].includes(requestingUserRole);
    if (!isOwner && !isStaff) {
      throw createError(403, "Bạn không có quyền xem tín hiệu này");
    }

    return BestMatchWellbeingSignal.list(bestMatchId, { status });
  },

  async updateSignalStatus({ signalId, status, reviewedBy, resolutionNotes, reviewerRole }) {
    if (![0, 1].includes(reviewerRole)) {
      throw createError(403, "Chỉ nhân viên/quản trị viên mới có thể cập nhật trạng thái tín hiệu");
    }

    const allowedStatuses = ["open", "monitoring", "resolved"];
    if (!allowedStatuses.includes(status)) {
      throw createError(400, "Trạng thái không hợp lệ");
    }

    const signal = await BestMatchWellbeingSignal.getById(signalId);
    if (!signal) throw createError(404, "Không tìm thấy tín hiệu");

    return BestMatchWellbeingSignal.updateStatus(signalId, { status, reviewedBy, resolutionNotes });
  },
};

module.exports = bestMatchWellbeingService;
