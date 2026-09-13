const bestMatchService = require("../service/bestMatchService");
const bestMatchStoryService = require("../service/bestMatchStoryService");
const BestMatchAssessmentService = require("../service/BestMatchAssessmentService");
const bestMatchWellbeingService = require("../service/bestMatchWellbeingService");
const BestMatchPrivacySettings = require("../models/BestMatchPrivacySettings");
const BestMatch = require("../models/BestMatch");
const bestMatchValidation = require("../validation/bestMatchValidation");
const { mapUploadedStoryMedia } = require("../middleware/bestMatchUploadHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const toValidId = (value) => {
  const n = Number(value);
  return !n || Number.isNaN(n) ? null : n;
};

const bestMatchApiV1Controller = {
  /** GET /api/v1/best-matches — active Best Matches for the badge/list */
  async listMine(req, res) {
    try {
      const bestMatches = await bestMatchService.getUserBestMatches(req.user.id);
      return sendSuccess(res, 200, "Tải danh sách Best Match thành công", { bestMatches });
    } catch (error) {
      console.error("[BestMatch API] listMine error:", error);
      return sendError(res, 500, "Không thể tải danh sách Best Match");
    }
  },

  /** GET /api/v1/best-matches/:id — full profile */
  async getProfile(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const profile = await bestMatchService.getBestMatchProfile(bestMatchId, req.user.id);
      return sendSuccess(res, 200, "Tải hồ sơ Best Match thành công", profile);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể tải hồ sơ Best Match");
    }
  },

  /** POST /api/v1/best-matches/:id/cancel */
  async cancel(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const { reason } = bestMatchValidation.validateCancel(req.body || {});
      const result = await bestMatchService.cancelBestMatch({ bestMatchId, userId: req.user.id, reason });
      return sendSuccess(res, 200, "Đã huỷ Best Match", { bestMatch: result });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể huỷ Best Match");
    }
  },

  /** GET /api/v1/best-matches/:id/privacy */
  async getPrivacy(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const owned = await BestMatch.isOwnedByUser(bestMatchId, req.user.id);
      if (!owned) return sendError(res, 403, "Bạn không có quyền xem cài đặt này");

      const settings = await BestMatchPrivacySettings.getByBestMatchId(bestMatchId);
      return sendSuccess(res, 200, "Tải cài đặt riêng tư thành công", { settings });
    } catch (error) {
      return sendError(res, 500, "Không thể tải cài đặt riêng tư");
    }
  },

  /** PUT /api/v1/best-matches/:id/privacy */
  async updatePrivacy(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const owned = await BestMatch.isOwnedByUser(bestMatchId, req.user.id);
      if (!owned) return sendError(res, 403, "Bạn không có quyền cập nhật cài đặt này");

      const fields = bestMatchValidation.validatePrivacyUpdate(req.body || {});
      const settings = await BestMatchPrivacySettings.update(bestMatchId, fields);
      return sendSuccess(res, 200, "Cập nhật cài đặt riêng tư thành công", { settings });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể cập nhật cài đặt riêng tư");
    }
  },

  /** GET /api/v1/best-matches/:id/stories */
  async listStories(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const stories = await bestMatchStoryService.listStories({
        bestMatchId,
        requestingUserId: req.user.id,
      });
      return sendSuccess(res, 200, "Tải danh sách câu chuyện thành công", { stories });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể tải câu chuyện");
    }
  },

  /** POST /api/v1/best-matches/:id/stories (multipart: media[]) */
  async createStory(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const mediaFiles = mapUploadedStoryMedia(req.files || []);

      const story = await bestMatchStoryService.createStory({
        bestMatchId,
        userId: req.user.id,
        title: req.body.title,
        content: req.body.content,
        storyDate: req.body.story_date,
        visibility: req.body.visibility,
        mediaFiles,
      });

      return sendSuccess(res, 201, "Đã lưu câu chuyện", { story });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể lưu câu chuyện");
    }
  },

  /** PUT /api/v1/best-matches/:id/stories/:storyId */
  async updateStory(req, res) {
    try {
      const storyId = toValidId(req.params.storyId);
      if (!storyId) return sendError(res, 400, "ID câu chuyện không hợp lệ");

      const story = await bestMatchStoryService.updateStory({
        storyId,
        userId: req.user.id,
        title: req.body.title,
        content: req.body.content,
        storyDate: req.body.story_date,
        visibility: req.body.visibility,
      });

      return sendSuccess(res, 200, "Đã cập nhật câu chuyện", { story });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể cập nhật câu chuyện");
    }
  },

  /** DELETE /api/v1/best-matches/:id/stories/:storyId */
  async deleteStory(req, res) {
    try {
      const storyId = toValidId(req.params.storyId);
      if (!storyId) return sendError(res, 400, "ID câu chuyện không hợp lệ");

      const result = await bestMatchStoryService.deleteStory({ storyId, userId: req.user.id });
      return sendSuccess(res, 200, "Đã xoá câu chuyện", result);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể xoá câu chuyện");
    }
  },

  /** GET /api/v1/best-matches/:id/assessment */
  async getAssessment(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const owned = await BestMatch.isOwnedByUser(bestMatchId, req.user.id);
      if (!owned) return sendError(res, 403, "Bạn không có quyền xem đánh giá này");

      const assessment = await BestMatchAssessmentService.getLatestOrAssess(bestMatchId);
      return sendSuccess(res, 200, "Tải đánh giá thành công", { assessment });
    } catch (error) {
      return sendError(res, 500, "Không thể tải đánh giá");
    }
  },

  /** GET /api/v1/best-matches/:id/wellbeing-signals (owner or staff) */
  async listWellbeingSignals(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const signals = await bestMatchWellbeingService.listSignals({
        bestMatchId,
        status: req.query.status || null,
        requestingUserId: req.user.id,
        requestingUserRole: req.user.role,
      });
      return sendSuccess(res, 200, "Tải danh sách tín hiệu thành công", { signals });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể tải tín hiệu");
    }
  },

  /** POST /api/v1/best-matches/:id/wellbeing-signals (staff/admin only) */
  async createWellbeingSignal(req, res) {
    try {
      const bestMatchId = toValidId(req.params.id);
      if (!bestMatchId) return sendError(res, 400, "ID không hợp lệ");

      const signal = await bestMatchWellbeingService.createSignal({
        bestMatchId,
        signalType: req.body.signal_type,
        severity: req.body.severity,
        description: req.body.description,
        sourceType: req.body.source_type,
        sourceId: req.body.source_id || null,
        metadata: req.body.metadata || null,
        createdByRole: req.user.role,
      });
      return sendSuccess(res, 201, "Đã ghi nhận tín hiệu", { signal });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể ghi nhận tín hiệu");
    }
  },

  /** PATCH /api/v1/best-matches/wellbeing-signals/:signalId/status (staff/admin only) */
  async updateWellbeingSignalStatus(req, res) {
    try {
      const signalId = toValidId(req.params.signalId);
      if (!signalId) return sendError(res, 400, "ID tín hiệu không hợp lệ");

      const signal = await bestMatchWellbeingService.updateSignalStatus({
        signalId,
        status: req.body.status,
        reviewedBy: req.user.id,
        resolutionNotes: req.body.resolution_notes || null,
        reviewerRole: req.user.role,
      });
      return sendSuccess(res, 200, "Đã cập nhật trạng thái tín hiệu", { signal });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể cập nhật tín hiệu");
    }
  },

  /**
   * POST /api/v1/best-matches/sync/:adoptionRequestId (staff/admin only)
   * Manual repair endpoint — idempotent, safe to call repeatedly.
   * Useful if the automatic hook in adoptionRequestService ever needs a
   * manual re-run for an older approved request.
   */
  async syncFromAdoptionRequest(req, res) {
    try {
      const adoptionRequestId = toValidId(req.params.adoptionRequestId);
      if (!adoptionRequestId) return sendError(res, 400, "adoptionRequestId không hợp lệ");

      const bestMatch = await bestMatchService.ensureBestMatchForOfficialAdoption(adoptionRequestId);
      if (!bestMatch) {
        return sendError(res, 409, "Hồ sơ nhận nuôi chưa ở trạng thái đã duyệt chính thức");
      }
      return sendSuccess(res, 200, "Đồng bộ Best Match thành công", { bestMatch });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể đồng bộ Best Match");
    }
  },
};

module.exports = bestMatchApiV1Controller;
