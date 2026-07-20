const HousingReview = require("../models/HousingReview");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { requireApiAuth } = require("../middleware/apiAuthV1");

const housingReviewApiV1Controller = {
  async getMyReviews(req, res) {
    try {
      const reviews = await HousingReview.findByUserId(req.user.id);
      return sendSuccess(res, 200, "Lấy danh sách đánh giá nhà ở thành công", { reviews });
    } catch (error) {
      console.error("[HousingReview] getMyReviews error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async create(req, res) {
    try {
      const { house_type, own_or_rent, has_allergies, has_pets, outdoor_space, has_children, time_at_home, experience, income, when_away } = req.body;
      if (!house_type || !own_or_rent) {
        return sendError(res, 400, "Vui lòng điền đầy đủ thông tin (house_type, own_or_rent)");
      }
      const validTypes = ["apartment", "house", "townhouse", "other"];
      const validTenures = ["own", "rent"];
      if (!validTypes.includes(house_type)) return sendError(res, 400, "Loại nhà ở không hợp lệ");
      if (!validTenures.includes(own_or_rent)) return sendError(res, 400, "Hình thức sở hữu không hợp lệ");

      await HousingReview.deactivate(req.user.id);
      const review = await HousingReview.create(req.user.id, { house_type, own_or_rent, has_allergies, has_pets, outdoor_space, has_children, time_at_home, experience, income, when_away });
      return sendSuccess(res, 201, "Tạo đánh giá nhà ở thành công", { review });
    } catch (error) {
      console.error("[HousingReview] create error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async update(req, res) {
    try {
      const { id } = req.query;
      if (!id) return sendError(res, 400, "Thiếu ID đánh giá");
      const updated = await HousingReview.update(Number(id), req.user.id, req.body);
      if (!updated) return sendError(res, 404, "Không tìm thấy đánh giá hoặc không thể cập nhật");
      return sendSuccess(res, 200, "Cập nhật đánh giá nhà ở thành công", { review: updated });
    } catch (error) {
      console.error("[HousingReview] update error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async getActive(req, res) {
    try {
      const review = await HousingReview.findActiveByUserId(req.user.id);
      return sendSuccess(res, 200, "Lấy đánh giá nhà ở thành công", { review: review || null });
    } catch (error) {
      console.error("[HousingReview] getActive error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.query;
      if (!id) return sendError(res, 400, "Thiếu ID đánh giá");
      const deleted = await HousingReview.delete(Number(id), req.user.id);
      if (!deleted) return sendError(res, 404, "Không tìm thấy đánh giá hoặc không thể xoá");
      return sendSuccess(res, 200, "Xoá đánh giá nhà ở thành công");
    } catch (error) {
      console.error("[HousingReview] delete error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async adminReview(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ (approved, rejected)");
      }
      const review = await HousingReview.review(Number(id), req.user.id, status, admin_notes);
      if (!review) return sendError(res, 404, "Không tìm thấy đánh giá");
      return sendSuccess(res, 200, "Cập nhật trạng thái đánh giá thành công", { review });
    } catch (error) {
      console.error("[HousingReview] adminReview error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async getPending(req, res) {
    try {
      const reviews = await HousingReview.findAllPending();
      return sendSuccess(res, 200, "Lấy danh sách đánh giá chờ duyệt thành công", { reviews });
    } catch (error) {
      console.error("[HousingReview] getPending error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },
};

module.exports = housingReviewApiV1Controller;
