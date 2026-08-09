const PetNote = require("../models/PetNote");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const notesApiV1Controller = {
  async getNote(req, res) {
    try {
      const userId = Number(req.user.id);
      const petId = Number(req.params.petId);
      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      const note = await PetNote.getNote(userId, petId);
      return sendSuccess(res, 200, "Lấy ghi chú thành công", { note });
    } catch (error) {
      console.error("[Notes API] getNote error:", error);
      return sendError(res, 500, "Không thể tải ghi chú");
    }
  },

  async saveNote(req, res) {
    try {
      const userId = Number(req.user.id);
      const petId = Number(req.params.petId);
      const { content } = req.body;

      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      if (typeof content !== "string") {
        return sendError(res, 400, "Nội dung ghi chú phải là chuỗi ký tự");
      }

      if (content.length > 500) {
        return sendError(res, 400, "Ghi chú không được vượt quá 500 ký tự");
      }

      const note = await PetNote.upsertNote(userId, petId, content);
      return sendSuccess(res, 200, "Lưu ghi chú thành công", { note });
    } catch (error) {
      console.error("[Notes API] saveNote error:", error);
      return sendError(res, 500, "Không thể lưu ghi chú");
    }
  },

  async deleteNote(req, res) {
    try {
      const userId = Number(req.user.id);
      const petId = Number(req.params.petId);

      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      await PetNote.deleteNote(userId, petId);
      return sendSuccess(res, 200, "Xóa ghi chú thành công", { petId });
    } catch (error) {
      console.error("[Notes API] deleteNote error:", error);
      return sendError(res, 500, "Không thể xóa ghi chú");
    }
  },
};

module.exports = notesApiV1Controller;
