/**
 * petReturnController.js
 * Nhận HTTP request, parse input, gọi service và trả JSON chuẩn.
 */
const petReturnService = require("../service/petReturnService");
const notificationService = require("../service/notificationService");
const { mapUploadedFiles } = require("../middleware/uploadHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const ALLOWED_STATUSES = ["approved_online", "completed", "rejected", "cancelled"];

const toValidId = (value) => {
  const n = Number(value);
  return !n || Number.isNaN(n) ? null : n;
};

const petReturnController = {
  /** POST /api/v1/pet-returns – User gửi yêu cầu trả */
  async createReturn(req, res) {
    try {
      const imageFiles = mapUploadedFiles(req.files || []);
      const result = await petReturnService.createReturnRequest({
        userId: req.user.id,
        petId: req.body.petId,
        reasonCategory: req.body.reasonCategory,
        reasonDetail: req.body.reasonDetail,
        imageFiles,
      });
      return sendSuccess(res, 201, "Gửi yêu cầu trả thú cưng thành công", { return: result });
    } catch (err) {
      return sendError(res, err.status || 500, err.message || "Không thể gửi yêu cầu trả");
    }
  },

  /** GET /api/v1/pet-returns/my – User xem hồ sơ của mình */
  async getMyReturns(req, res) {
    try {
      const returns = await petReturnService.getMyReturns(req.user.id);
      return sendSuccess(res, 200, "Tải danh sách yêu cầu trả thành công", { returns });
    } catch (err) {
      return sendError(res, 500, "Không thể tải danh sách yêu cầu trả");
    }
  },

  /** GET /api/v1/pet-returns/admin – Staff/Admin xem tất cả */
  async getAdminReturns(req, res) {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)));
      const status = req.query.status || null;

      const result = await petReturnService.getAdminReturns({ status, page, limit });
      return sendSuccess(res, 200, "Tải danh sách hồ sơ trả thành công", {
        data: result.data,
        total: result.total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
      });
    } catch (err) {
      return sendError(res, 500, "Không thể tải danh sách hồ sơ trả");
    }
  },

  /** GET /api/v1/pet-returns/:id – Chi tiết hồ sơ */
  async getReturnById(req, res) {
    try {
      const returnId = toValidId(req.params.id);
      if (!returnId) return sendError(res, 400, "ID không hợp lệ");

      const record = await petReturnService.getReturnById(returnId);

      // User chỉ được xem của mình
      if (req.user.role === 2 && Number(record.user_id) !== req.user.id) {
        return sendError(res, 403, "Bạn không có quyền xem hồ sơ này");
      }

      return sendSuccess(res, 200, "Tải chi tiết hồ sơ trả thành công", { record });
    } catch (err) {
      return sendError(res, err.status || 500, err.message || "Không thể tải chi tiết");
    }
  },

  /** PATCH /api/v1/pet-returns/:id/status – Staff/Admin hoặc User cancel */
  async updateStatus(req, res) {
    try {
      const returnId = toValidId(req.params.id);
      if (!returnId) return sendError(res, 400, "ID không hợp lệ");

      const nextStatus = String(req.body.status || "").trim();
      if (!ALLOWED_STATUSES.includes(nextStatus)) {
        return sendError(res, 400, `Trạng thái không hợp lệ. Cho phép: ${ALLOWED_STATUSES.join(", ")}`);
      }

      const result = await petReturnService.updateStatus({
        returnId,
        nextStatus,
        reviewerId: req.user.id,
        adminNotes: req.body.adminNotes || null,
        userRole: req.user.role,
      });

      return sendSuccess(res, 200, "Cập nhật trạng thái thành công", { return: result });
    } catch (err) {
      return sendError(res, err.status || 500, err.message || "Không thể cập nhật trạng thái");
    }
  },

  /** GET /api/v1/notifications – User xem thông báo */
  async getNotifications(req, res) {
    try {
      const notiList = await notificationService.getForUser(req.user.id);
      const unread = await notificationService.countUnread(req.user.id);
      return sendSuccess(res, 200, "Tải thông báo thành công", { notifications: notiList, unread });
    } catch (err) {
      return sendError(res, 500, "Không thể tải thông báo");
    }
  },

  /** PATCH /api/v1/notifications/read-all – Đánh dấu đã đọc tất cả */
  async markNotificationsRead(req, res) {
    try {
      await notificationService.markAllRead(req.user.id);
      return sendSuccess(res, 200, "Đã đánh dấu tất cả thông báo là đã đọc");
    } catch (err) {
      return sendError(res, 500, "Không thể cập nhật thông báo");
    }
  },
};

module.exports = petReturnController;
