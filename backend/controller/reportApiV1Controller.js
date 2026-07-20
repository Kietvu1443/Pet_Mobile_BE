const reportService = require("../service/reportService");
const { isProduction, getImageUrl, getCloudinaryId } = require("../config/upload");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const PHONE_REGEX = /^[0-9\-\+]{9,15}$/;

const REPORT_TYPES = ["lost", "found"];
const REPORT_STATUSES = ["approved", "rejected", "resolved"];

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizePhone = (phone) => String(phone || "").trim();

const buildLostReportData = (payload) => {
  return {
    type: "lost",
    reporter_name: payload.name || null,
    phone: normalizePhone(payload.phone),
    email: payload.email || null,
    address: payload.location || null,
    found_location: null,
    pet_code: null,
    pet_type: payload.pet_type || "Khác",
    species: payload.species || null,
    color: payload.color || null,
    gender: payload.gender || "unknown",
    description: payload.description || null,
  };
};

const buildFoundReportData = (payload) => {
  return {
    type: "found",
    reporter_name: payload.finderName || null,
    phone: normalizePhone(payload.phone),
    email: payload.email || null,
    address: null,
    found_location: payload.location || null,
    pet_code: null,
    pet_type: payload.species || "Khác",
    species: null,
    color: payload.furColor || null,
    gender: payload.gender || "unknown",
    description: payload.description || null,
  };
};

const reportApiV1Controller = {
  async submitReport(req, res) {
    try {
      const reportType = String(req.body.type || "").trim();

      if (!REPORT_TYPES.includes(reportType)) {
        return sendError(res, 400, "Loại báo cáo không hợp lệ (lost hoặc found)");
      }

      const uploadedFiles = Array.isArray(req.files) ? req.files : [];
      if (uploadedFiles.length === 0) {
        return sendError(res, 400, "Vui lòng tải lên ít nhất một ảnh");
      }

      const reportData =
        reportType === "lost"
          ? buildLostReportData(req.body)
          : buildFoundReportData(req.body);

      if (!reportData.phone || !PHONE_REGEX.test(reportData.phone)) {
        return sendError(res, 400, "Số điện thoại không hợp lệ (9-15 ký tự số)");
      }

      reportData.user_id = req.user && req.user.id ? Number(req.user.id) : null;

      const imageRecords = uploadedFiles.map((file) => ({
        imagePath: isProduction ? file.path : getImageUrl(file),
        cloudinaryId: getCloudinaryId(file),
      }));

      const createdReport = await reportService.createReport(reportData, imageRecords);

      return sendSuccess(res, 201, "Gửi báo cáo thành công", {
        report: createdReport,
      });
    } catch (error) {
      console.error("[Report API v1] submitReport error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi gửi báo cáo");
    }
  },

  async getPublicReports(req, res) {
    try {
      const type = req.query.type || null;
      const page = Math.max(1, toNumber(req.query.page, 1));
      const limit = Math.min(50, Math.max(1, toNumber(req.query.limit, 12)));

      const result = await reportService.getPublicReports({ type, page, limit });

      return sendSuccess(res, 200, "Lấy danh sách báo cáo thành công", result);
    } catch (error) {
      console.error("[Report API v1] getPublicReports error:", error);
      return sendError(res, 500, "Không thể tải danh sách báo cáo");
    }
  },

  async getMyReports(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : 0;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập");
      }

      const view = req.query.view === "recent" ? "recent" : "full";

      if (view === "recent") {
        const limit = Math.min(10, Math.max(5, toNumber(req.query.limit, 8)));
        const result = await reportService.getMyRecentReports({ userId, limit });
        return sendSuccess(res, 200, "Lấy báo cáo gần đây thành công", {
          view,
          ...result,
        });
      }

      const status = ["pending", "approved", "rejected"].includes(req.query.status)
        ? req.query.status
        : null;
      const type = REPORT_TYPES.includes(req.query.type) ? req.query.type : null;
      const page = Math.max(1, toNumber(req.query.page, 1));
      const limit = Math.min(24, Math.max(6, toNumber(req.query.limit, 12)));

      const result = await reportService.getMyReports({
        userId,
        status,
        type,
        page,
        limit,
      });

      return sendSuccess(res, 200, "Lấy báo cáo của bạn thành công", {
        view,
        ...result,
      });
    } catch (error) {
      console.error("[Report API v1] getMyReports error:", error);
      return sendError(res, 500, "Không thể tải báo cáo của bạn");
    }
  },

  async getAdminReports(req, res) {
    try {
      const page = Math.max(1, toNumber(req.query.page, 1));
      const pageSize = Math.min(100, Math.max(1, toNumber(req.query.pageSize || req.query.limit, 50)));

      const result = await reportService.getAdminReports({ page, limit: pageSize });
      return sendSuccess(res, 200, "Lấy danh sách báo cáo quản trị thành công", {
        data: result.data,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      });
    } catch (error) {
      console.error("[Report API v1] getAdminReports error:", error);
      return sendError(res, 500, "Không thể tải danh sách báo cáo");
    }
  },

  async updateReportStatus(req, res) {
    try {
      const reportId = Number(req.params.id);
      const status = req.body.status;

      if (!reportId || Number.isNaN(reportId)) {
        return sendError(res, 400, "ID báo cáo không hợp lệ");
      }

      if (!REPORT_STATUSES.includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ");
      }

      const result = await reportService.updateReportStatus({ reportId, status });
      return sendSuccess(res, 200, "Cập nhật trạng thái thành công", {
        report: result,
      });
    } catch (error) {
      const statusCode = error.status || 500;
      return sendError(
        res,
        statusCode,
        error.message || "Không thể cập nhật trạng thái",
      );
    }
  },

  async revertReport(req, res) {
    try {
      const reportId = Number(req.params.id);
      if (!reportId || Number.isNaN(reportId)) {
        return sendError(res, 400, "ID báo cáo không hợp lệ");
      }

      const result = await reportService.revertReport({ reportId });
      return sendSuccess(res, 200, "Hoàn tác thành công", {
        report: result,
      });
    } catch (error) {
      const statusCode = error.status || 500;
      return sendError(res, statusCode, error.message || "Không thể hoàn tác báo cáo");
    }
  },

  async deleteReport(req, res) {
    try {
      const reportId = Number(req.params.id);
      if (!reportId || Number.isNaN(reportId)) {
        return sendError(res, 400, "ID báo cáo không hợp lệ");
      }

      const result = await reportService.deleteReport(reportId);
      return sendSuccess(res, 200, "Xóa báo cáo thành công", {
        report: result,
      });
    } catch (error) {
      const statusCode = error.status || 500;
      return sendError(res, statusCode, error.message || "Không thể xóa báo cáo");
    }
  },
};

module.exports = reportApiV1Controller;
