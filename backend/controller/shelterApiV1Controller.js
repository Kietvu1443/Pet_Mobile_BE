const Shelter = require("../models/Shelter");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const shelterApiV1Controller = {
  async getMyShelter(req, res) {
    try {
      const shelter = await Shelter.findByUserId(req.user.id);
      return sendSuccess(res, 200, "Lấy thông tin trại cứu hộ thành công", { shelter: shelter || null });
    } catch (error) {
      console.error("[Shelter] getMyShelter error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async create(req, res) {
    try {
      const { name, description, address, phone } = req.body;
      if (!name || !address || !phone) {
        return sendError(res, 400, "Vui lòng điền đầy đủ thông tin (name, address, phone)");
      }
      const existing = await Shelter.findByUserId(req.user.id);
      if (existing) return sendError(res, 409, "Bạn đã có trại cứu hộ rồi");
      const shelter = await Shelter.create(req.user.id, { name, description, address, phone });
      return sendSuccess(res, 201, "Đăng ký trại cứu hộ thành công", { shelter });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "Bạn đã có trại cứu hộ rồi");
      }
      console.error("[Shelter] create error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async update(req, res) {
    try {
      const { name, description, address, phone } = req.body;
      const existing = await Shelter.findByUserId(req.user.id);
      if (!existing) return sendError(res, 404, "Không tìm thấy trại cứu hộ");
      const updated = await Shelter.update(existing.id, req.user.id, { name, description, address, phone });
      if (!updated) return sendError(res, 404, "Không tìm thấy trại cứu hộ");
      return sendSuccess(res, 200, "Cập nhật trại cứu hộ thành công", { shelter: updated });
    } catch (error) {
      console.error("[Shelter] update error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },
};

module.exports = shelterApiV1Controller;
