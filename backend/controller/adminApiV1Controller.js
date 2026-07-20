const User = require("../models/User");
const Report = require("../models/Report");
const HousingReview = require("../models/HousingReview");
const Shelter = require("../models/Shelter");
const { pool } = require("../config/db");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const notificationService = require("../service/notificationService");
const NOTIF_TYPES = require("../shared/constants/notificationTypes");

const ALLOWED_STATUSES = ["active", "banned"];
const ALLOWED_ROLES = [1, 2]; // Admin (0) cannot be assigned via API
const ALLOWED_REPORT_ACTIONS = ["resolve", "reject", "ban"];
const ALLOWED_REVIEW_STATUSES = ["approved", "rejected"];

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const adminApiV1Controller = {
  /**
   * GET /api/v1/admin/users
   * Admin & Staff can view users with pagination and filtering.
   */
  async getUsers(req, res) {
    try {
      const page = Math.max(1, toNumber(req.query.page, 1));
      const pageSize = Math.min(50, Math.max(1, toNumber(req.query.pageSize || req.query.limit, 20)));
      const status = ALLOWED_STATUSES.includes(req.query.status) ? req.query.status : undefined;
      const role = req.query.role !== undefined ? Number(req.query.role) : undefined;

      // Validate role filter
      if (role !== undefined && ![0, 1, 2].includes(role)) {
        return sendError(res, 400, "Giá trị role không hợp lệ (0, 1, hoặc 2)");
      }

      const result = await User.findAll({ page, limit: pageSize, status, role });
      const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

      return sendSuccess(res, 200, "Lấy danh sách người dùng thành công", {
        data: result.data,
        page,
        pageSize,
        total: result.total,
        totalPages,
      });
    } catch (error) {
      console.error("[Admin API v1] getUsers error:", error);
      return sendError(res, 500, "Không thể tải danh sách người dùng");
    }
  },

  /**
   * PATCH /api/v1/admin/users/:id/role
   * Admin only. Change user role (staff <-> user).
   */
  async updateUserRole(req, res) {
    try {
      const targetId = Number(req.params.id);
      const newRole = Number(req.body.role);

      // Validate input
      if (!targetId || Number.isNaN(targetId)) {
        return sendError(res, 400, "ID người dùng không hợp lệ");
      }
      if (!ALLOWED_ROLES.includes(newRole)) {
        return sendError(res, 400, "Giá trị role không hợp lệ (chỉ cho phép 1 hoặc 2)");
      }

      // Prevent self-modification
      if (req.user.id === targetId) {
        return sendError(res, 400, "Bạn không thể tự thay đổi quyền của chính mình");
      }

      // Check target user exists
      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        return sendError(res, 404, "Không tìm thấy người dùng");
      }

      // Prevent changing another admin's role
      if (targetUser.role === 0) {
        return sendError(res, 403, "Không thể thay đổi quyền của admin khác");
      }

      const updated = await User.updateRole(targetId, newRole);
      if (!updated) {
        return sendError(res, 500, "Không thể cập nhật quyền người dùng");
      }

      return sendSuccess(res, 200, "Cập nhật quyền thành công", {
        userId: targetId,
        role: newRole,
      });
    } catch (error) {
      console.error("[Admin API v1] updateUserRole error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi cập nhật quyền");
    }
  },

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Admin only. Ban or unban a user.
   */
  async updateUserStatus(req, res) {
    try {
      const targetId = Number(req.params.id);
      const status = req.body.status;
      const reason = String(req.body.reason || "").trim() || null;

      // Validate input
      if (!targetId || Number.isNaN(targetId)) {
        return sendError(res, 400, "ID người dùng không hợp lệ");
      }
      if (!ALLOWED_STATUSES.includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ (active hoặc banned)");
      }

      // Prevent self-ban
      if (req.user.id === targetId) {
        return sendError(res, 400, "Bạn không thể tự khóa chính mình");
      }

      // Check target user exists
      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        return sendError(res, 404, "Không tìm thấy người dùng");
      }

      // Prevent banning another admin
      if (targetUser.role === 0) {
        return sendError(res, 403, "Không thể khóa tài khoản admin khác");
      }

      const updated = await User.updateStatus(targetId, status, reason);
      if (!updated) {
        return sendError(res, 500, "Không thể cập nhật trạng thái người dùng");
      }

      return sendSuccess(res, 200, status === "banned" ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản", {
        userId: targetId,
        status,
      });
    } catch (error) {
      console.error("[Admin API v1] updateUserStatus error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi cập nhật trạng thái");
    }
  },

  /**
   * GET /api/v1/admin/reports
   * Admin & Staff can view reports with pagination and status filter.
   */
  async getReports(req, res) {
    try {
      const page = Math.max(1, toNumber(req.query.page, 1));
      const pageSize = Math.min(100, Math.max(1, toNumber(req.query.pageSize || req.query.limit, 20)));
      const status = req.query.status || null;

      // Validate status filter
      if (status && !["pending", "approved", "rejected", "resolved"].includes(status)) {
        return sendError(res, 400, "Trạng thái lọc không hợp lệ");
      }

      const result = await Report.findAll({ page, limit: pageSize, status });
      const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

      return sendSuccess(res, 200, "Lấy danh sách báo cáo thành công", {
        data: result.data,
        page,
        pageSize,
        total: result.total,
        totalPages,
      });
    } catch (error) {
      console.error("[Admin API v1] getReports error:", error);
      return sendError(res, 500, "Không thể tải danh sách báo cáo");
    }
  },

  /**
   * PATCH /api/v1/admin/reports/:id
   * Admin only. Handle a report: resolve, reject, or ban (resolve + ban user).
   * The "ban" action uses a database transaction.
   */
  async handleReport(req, res) {
    try {
      const reportId = Number(req.params.id);
      const action = req.body.action;
      const reason = String(req.body.reason || "").trim() || null;

      // Validate input
      if (!reportId || Number.isNaN(reportId)) {
        return sendError(res, 400, "ID báo cáo không hợp lệ");
      }
      if (!ALLOWED_REPORT_ACTIONS.includes(action)) {
        return sendError(res, 400, "Hành động không hợp lệ (resolve, reject, hoặc ban)");
      }

      // Find report
      const report = await Report.findById(reportId);
      if (!report) {
        return sendError(res, 404, "Không tìm thấy báo cáo");
      }
      if (report.status !== "pending" && report.status !== "approved") {
        return sendError(res, 409, "Báo cáo này đã được xử lý");
      }

      // Simple resolve or reject (no transaction needed)
      if (action === "resolve" || action === "reject") {
        const newStatus = action === "resolve" ? "resolved" : "rejected";
        await Report.updateStatus(reportId, newStatus);
        return sendSuccess(res, 200, `Báo cáo đã được ${action === "resolve" ? "xử lý" : "từ chối"}`, {
          reportId,
          status: newStatus,
        });
      }

      // Ban action: resolve report + ban user in a transaction
      if (action === "ban") {
        if (!report.user_id) {
          return sendError(res, 400, "Báo cáo này không có thông tin người dùng để khóa");
        }

        // Check the target user
        const targetUser = await User.findById(report.user_id);
        if (!targetUser) {
          return sendError(res, 404, "Không tìm thấy người dùng liên quan");
        }
        if (targetUser.role === 0) {
          return sendError(res, 403, "Không thể khóa tài khoản admin");
        }
        if (targetUser.status === "banned") {
          // User already banned, just resolve the report
          await Report.updateStatus(reportId, "resolved");
          return sendSuccess(res, 200, "Người dùng đã bị khóa trước đó. Báo cáo đã được xử lý.", {
            reportId,
            status: "resolved",
            userId: report.user_id,
            userStatus: "banned",
          });
        }

        // Transaction: resolve report + ban user
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          await connection.execute(
            "UPDATE reports SET status = 'resolved' WHERE id = ?",
            [reportId],
          );

          const bannedAt = new Date();
          const banReason = reason || "Vi phạm quy định (từ báo cáo #" + reportId + ")";
          await connection.execute(
            "UPDATE users SET status = 'banned', banned_reason = ?, banned_at = ? WHERE id = ?",
            [banReason, bannedAt, report.user_id],
          );

          await connection.commit();

          return sendSuccess(res, 200, "Đã xử lý báo cáo và khóa tài khoản người dùng", {
            reportId,
            status: "resolved",
            userId: report.user_id,
            userStatus: "banned",
          });
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
    } catch (error) {
      console.error("[Admin API v1] handleReport error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xử lý báo cáo");
    }
  },

  // ============ HOUSING REVIEW ADMIN ============

  /**
   * GET /api/v1/admin/housing-reviews
   * Admin & Staff can view housing reviews with pagination and status filter.
   */
  async getHousingReviews(req, res) {
    try {
      const page = Math.max(1, toNumber(req.query.page, 1));
      const pageSize = Math.min(100, Math.max(1, toNumber(req.query.pageSize || req.query.limit, 10)));
      const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : undefined;
      const result = await HousingReview.findAll({ page, limit: pageSize, status });
      return sendSuccess(res, 200, "Lấy danh sách đánh giá nhà ở thành công", {
        data: result.data,
        page,
        pageSize,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error("[Admin API v1] getHousingReviews error:", error);
      return sendError(res, 500, "Không thể tải danh sách đánh giá nhà ở");
    }
  },

  /**
   * PATCH /api/v1/admin/housing-reviews/:id/status
   * Admin only. Approve or reject a housing review.
   */
  async reviewHousingReview(req, res) {
    try {
      const reviewId = Number(req.params.id);
      const status = req.body.status;
      const adminNotes = String(req.body.admin_notes || "").trim() || null;

      if (!reviewId || Number.isNaN(reviewId)) {
        return sendError(res, 400, "ID bài đánh giá không hợp lệ");
      }
      if (!ALLOWED_REVIEW_STATUSES.includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ (approved hoặc rejected)");
      }

      const review = await HousingReview.findById(reviewId);
      if (!review) {
        return sendError(res, 404, "Không tìm thấy bài đánh giá");
      }
      if (review.status !== "pending") {
        return sendError(res, 409, "Bài đánh giá này đã được xử lý");
      }

      const updated = await HousingReview.review(reviewId, req.user.id, status, adminNotes);
      if (!updated) {
        return sendError(res, 500, "Không thể cập nhật trạng thái bài đánh giá");
      }

      const notifKey = status === "approved" ? "HOUSING_APPROVED" : "HOUSING_REJECTED";
      notificationService.send({
        userId: review.user_id,
        title: status === "approved" ? "✅ Đánh giá nhà ở đã được duyệt" : "❌ Đánh giá nhà ở bị từ chối",
        message: status === "approved"
          ? "Đánh giá nhà ở của bạn đã được duyệt. Bạn có thể tiếp tục nhận nuôi."
          : `Đánh giá nhà ở của bạn đã bị từ chối.${adminNotes ? ` Lý do: ${adminNotes}` : ""}`,
        type: NOTIF_TYPES[notifKey],
        data: { reviewId, status },
      });

      return sendSuccess(res, 200, status === "approved" ? "Đã duyệt bài đánh giá" : "Đã từ chối bài đánh giá", {
        data: updated,
      });
    } catch (error) {
      console.error("[Admin API v1] reviewHousingReview error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xử lý bài đánh giá");
    }
  },

  // ============ SHELTER ADMIN ============

  /**
   * GET /api/v1/admin/shelters
   * Admin & Staff can view shelters with pagination and status filter.
   */
  async getShelters(req, res) {
    try {
      const page = Math.max(1, toNumber(req.query.page, 1));
      const pageSize = Math.min(100, Math.max(1, toNumber(req.query.pageSize || req.query.limit, 10)));
      const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : undefined;
      const result = await Shelter.findAll({ page, limit: pageSize, status });
      return sendSuccess(res, 200, "Lấy danh sách trại cứu hộ thành công", {
        data: result.data,
        page,
        pageSize,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error("[Admin API v1] getShelters error:", error);
      return sendError(res, 500, "Không thể tải danh sách trại cứu hộ");
    }
  },

  /**
   * PATCH /api/v1/admin/shelters/:id/status
   * Admin only. Approve or reject a shelter.
   */
  async reviewShelter(req, res) {
    try {
      const shelterId = Number(req.params.id);
      const status = req.body.status;
      const adminNotes = String(req.body.admin_notes || "").trim() || null;

      if (!shelterId || Number.isNaN(shelterId)) {
        return sendError(res, 400, "ID trại tạm trú không hợp lệ");
      }
      if (!ALLOWED_REVIEW_STATUSES.includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ (approved hoặc rejected)");
      }

      const shelter = await Shelter.findById(shelterId);
      if (!shelter) {
        return sendError(res, 404, "Không tìm thấy trại tạm trú");
      }
      if (shelter.status !== "pending") {
        return sendError(res, 409, "Trại tạm trú này đã được xử lý");
      }

      const updated = await Shelter.review(shelterId, req.user.id, status, adminNotes);
      if (!updated) {
        return sendError(res, 500, "Không thể cập nhật trạng thái trại tạm trú");
      }

      const notifKey = status === "approved" ? "SHELTER_APPROVED" : "SHELTER_REJECTED";
      notificationService.send({
        userId: shelter.user_id,
        title: status === "approved" ? "✅ Trại cứu hộ đã được duyệt" : "❌ Trại cứu hộ bị từ chối",
        message: status === "approved"
          ? "Trại cứu hộ của bạn đã được duyệt. Bạn có thể quản lý thú cưng và nhận yêu cầu nhận nuôi."
          : `Trại cứu hộ của bạn đã bị từ chối.${adminNotes ? ` Lý do: ${adminNotes}` : ""}`,
        type: NOTIF_TYPES[notifKey],
        data: { shelterId, status },
      });

      return sendSuccess(res, 200, status === "approved" ? "Đã duyệt trại tạm trú" : "Đã từ chối trại tạm trú", {
        data: updated,
      });
    } catch (error) {
      console.error("[Admin API v1] reviewShelter error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xử lý trại tạm trú");
    }
  },
};

module.exports = adminApiV1Controller;
