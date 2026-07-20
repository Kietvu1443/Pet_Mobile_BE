const { pool } = require("../config/db");
const Report = require("../models/Report");
const PetImage = require("../models/PetImage");
const { deleteImage } = require("../config/upload");

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const reportService = {
  /**
   * Create a report with images inside a DB transaction.
   * @param {object} reportData - The report fields
   * @param {Array} imageRecords - Array of {imagePath, cloudinaryId}
   */
  async createReport(reportData, imageRecords = []) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert report
      const report = await Report.create(reportData, connection);

      // Insert images
      for (let i = 0; i < imageRecords.length; i++) {
        await PetImage.createForReport(
          report.id,
          imageRecords[i].imagePath,
          i, // display_order
          imageRecords[i].cloudinaryId || null,
          connection,
        );
      }

      await connection.commit();
      return report;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Get all reports for admin with pagination
   */
  async getAdminReports({ page = 1, limit = 20 } = {}) {
    const result = await Report.findAll({ page, limit });
    const totalPages = Math.ceil(result.total / limit);
    return {
      data: result.data,
      page,
      limit,
      total: result.total,
      totalPages,
    };
  },

  /**
   * Get approved reports for public view with pagination
   */
  async getPublicReports({ type, page = 1, limit = 20 } = {}) {
    const result = await Report.findApproved({ type, page, limit });
    const totalPages = Math.ceil(result.total / limit);
    return {
      data: result.data,
      page,
      limit,
      total: result.total,
      totalPages,
    };
  },

  /**
   * Get current user's reports for full management page.
   */
  async getMyReports({ userId, status, type, page = 1, limit = 12 } = {}) {
    const result = await Report.findByUser({ userId, status, type, page, limit });
    const summary = await Report.getStatusSummaryByUser(userId);
    const totalPages = Math.ceil(result.total / limit);
    return {
      data: result.data,
      page,
      limit,
      total: result.total,
      totalPages,
      filters: {
        status: status || null,
        type: type || null,
      },
      summary,
    };
  },

  /**
   * Get current user's recent reports for quick overlay.
   */
  async getMyRecentReports({ userId, limit = 8 } = {}) {
    const data = await Report.findRecentByUser({ userId, limit });
    return {
      data,
      limit,
      total: data.length,
    };
  },

  /**
   * Update report status (approve / reject). No cloudinary cleanup on reject.
   */
  async updateReportStatus({ reportId, status }) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw createError(404, "Không tìm thấy báo cáo");
    }

    // Validate allowed transitions
    if (report.status === "pending" && !["approved", "rejected"].includes(status)) {
      throw createError(400, "Trạng thái không hợp lệ");
    }

    const updated = await Report.updateStatus(reportId, status);
    if (!updated) {
      throw createError(500, "Không thể cập nhật trạng thái");
    }

    return { id: reportId, status };
  },

  /**
   * Revert approved report back to pending
   */
  async revertReport({ reportId }) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw createError(404, "Không tìm thấy báo cáo");
    }
    if (report.status !== "approved") {
      throw createError(409, "Chỉ có thể hoàn tác báo cáo đã được duyệt");
    }

    await Report.updateStatus(reportId, "pending");
    return { id: reportId, status: "pending" };
  },

  /**
   * Permanently delete a report and clean up Cloudinary images.
   */
  async deleteReport(reportId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw createError(404, "Không tìm thấy báo cáo");
    }

    // Cleanup images from Cloudinary
    const images = await PetImage.findByReportId(reportId);
    for (const img of images) {
      await deleteImage(img.image_path, img.cloudinary_id);
    }
    await PetImage.deleteByReportId(reportId);

    await Report.delete(reportId);
    return { id: reportId, deleted: true };
  },
};

module.exports = reportService;
