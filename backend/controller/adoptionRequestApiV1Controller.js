const adoptionRequestService = require("../service/adoptionRequestService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const allowedStatuses = ["approved", "rejected"];

const toValidId = (value) => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const adoptionRequestApiV1Controller = {
  async createRequest(req, res) {
    try {
      const petId = toValidId(req.body.petId);
      const message = String(req.body.message || "").trim();

      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      if (!message) {
        return sendError(res, 400, "Vui lòng nhập lý do nhận nuôi");
      }

      const request = await adoptionRequestService.createAdoptionRequest({
        userId: req.user.id,
        petId,
        message,
        verify: req.user.verify,
      });

      return sendSuccess(res, 201, "Đăng ký nhận nuôi thành công", { request });
    } catch (error) {
      return sendError(
        res,
        error.status || 500,
        error.message || "Không thể gửi yêu cầu nhận nuôi",
      );
    }
  },

  async getMyRequests(req, res) {
    try {
      const requests = await adoptionRequestService.getUserAdoptionRequests({
        userId: req.user.id,
      });

      return sendSuccess(res, 200, "Tải danh sách yêu cầu nhận nuôi thành công", {
        requests,
      });
    } catch (error) {
      return sendError(res, 500, "Không thể tải danh sách yêu cầu nhận nuôi");
    }
  },

  async getAdminRequests(req, res) {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || req.query.limit || 10)));

      const result = await adoptionRequestService.getAdminAdoptionRequests({
        page,
        limit: pageSize,
      });

      return sendSuccess(res, 200, "Tải danh sách hồ sơ nhận nuôi thành công", {
        data: result.data,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      });
    } catch (error) {
      return sendError(res, 500, "Không thể tải danh sách hồ sơ");
    }
  },

  async updateStatus(req, res) {
    try {
      const requestId = toValidId(req.params.id);
      const status = req.body.status;

      if (!requestId) {
        return sendError(res, 400, "ID hồ sơ không hợp lệ");
      }

      if (!allowedStatuses.includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ");
      }

      const request = await adoptionRequestService.updateAdoptionRequestStatus({
        requestId,
        status,
        reviewerId: req.user.id,
      });

      return sendSuccess(res, 200, "Cập nhật trạng thái thành công", { request });
    } catch (error) {
      return sendError(
        res,
        error.status || 500,
        error.message || "Không thể cập nhật trạng thái",
      );
    }
  },
};

module.exports = adoptionRequestApiV1Controller;
