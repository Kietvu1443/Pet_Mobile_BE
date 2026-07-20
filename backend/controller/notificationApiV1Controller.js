const notificationService = require("../service/notificationService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const notificationApiV1Controller = {
  async getNotifications(req, res) {
    try {
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const page = Math.max(1, Number(req.query.page) || 1);
      const offset = (page - 1) * limit;
      const notifications = await notificationService.getForUser(
        req.user.id,
        limit,
        offset,
      );
      const total = await notificationService.countUnread(req.user.id);
      return sendSuccess(res, 200, "Lấy danh sách thông báo thành công", {
        notifications,
        unread: total,
      });
    } catch (error) {
      console.error("[Notification API v1] getNotifications error:", error);
      return sendError(res, 500, "Không thể tải thông báo");
    }
  },

  async markAllRead(req, res) {
    try {
      await notificationService.markAllRead(req.user.id);
      return sendSuccess(res, 200, "Đã đánh dấu tất cả thông báo là đã đọc");
    } catch (error) {
      console.error("[Notification API v1] markAllRead error:", error);
      return sendError(res, 500, "Không thể cập nhật thông báo");
    }
  },
};

module.exports = notificationApiV1Controller;
