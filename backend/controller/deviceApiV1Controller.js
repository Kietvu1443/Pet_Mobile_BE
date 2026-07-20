const UserDevice = require("../models/UserDevice");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const deviceApiV1Controller = {
  async register(req, res) {
    try {
      if (!req.user || !req.user.id) return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      const { push_token, device_platform } = req.body;
      if (!push_token || !device_platform) {
        return sendError(res, 400, "Thiếu push_token hoặc device_platform");
      }
      const device = await UserDevice.register(req.user.id, push_token, device_platform);
      return sendSuccess(res, 201, "Đăng ký thiết bị thành công", { device });
    } catch (error) {
      console.error("[Device] register error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async unregister(req, res) {
    try {
      const { token } = req.params;
      if (!token) return sendError(res, 400, "Thiếu push_token");
      const deleted = await UserDevice.unregister(token);
      if (!deleted) return sendError(res, 404, "Không tìm thấy thiết bị");
      return sendSuccess(res, 200, "Huỷ đăng ký thiết bị thành công");
    } catch (error) {
      console.error("[Device] unregister error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },
};

module.exports = deviceApiV1Controller;
