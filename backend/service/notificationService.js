/**
 * notificationService.js
 * Ghi thông báo vào bảng `notifications`.
 * Thiết kế mở rộng: có thể thêm email/push sau này.
 */
const { pool } = require("../config/db");
const User = require("../models/User");
const UserDevice = require("../models/UserDevice");
const { sendPushNotifications } = require("../utils/expoPush");
const NOTIF_TYPES = require("../shared/constants/notificationTypes");

const notificationService = {
  /**
   * Gửi thông báo cho một user.
   * Legacy signature: send(userId, title, message, type)
   * Modern signature:  send({ userId, title, message, type, data })
   * @param {number|Object} userIdOrObj
   * @param {string} [title]
   * @param {string} [message]
   * @param {string} [type]
   */
  async send(userIdOrObj, title, message, type = "return_workflow") {
    try {
      let userId, data;
      if (typeof userIdOrObj === "object") {
        userId = userIdOrObj.userId;
        title = userIdOrObj.title;
        message = userIdOrObj.message;
        type = userIdOrObj.type || "system";
        data = userIdOrObj.data;
      } else {
        userId = userIdOrObj;
      }

      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        [userId, title, message, type],
      );

      // Check user push preference — skip push dispatch if disabled
      const pushPref = await User.findById(userId)
        .then(u => u?.preferences?.pushEnabled)
        .catch(() => null);
      if (pushPref === false) return;

      // Push dispatch in background — never block the request lifecycle
      const devices = await UserDevice.findByUserId(userId).catch(() => []);
      if (devices && devices.length > 0) {
        const tokens = devices.map((d) => d.push_token).filter(Boolean);
        if (tokens.length > 0) {
          void sendPushNotifications(tokens, title, message, {
            type,
            ...data,
          }).catch(console.error);
        }
      }
    } catch (err) {
      // Không throw để không làm gián đoạn luồng chính
      console.error(
        "[notificationService] Ghi thông báo thất bại:",
        err.message,
      );
    }
  },

  /**
   * Lấy danh sách thông báo của user với phân trang.
   */
  async getForUser(userId, limit = 20, offset = 0) {
    const [rows] = await pool.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, String(limit), String(offset)],
    );
    return rows;
  },

  /**
   * Đánh dấu tất cả thông báo của user là đã đọc.
   */
  async markAllRead(userId) {
    await pool.execute(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
  },

  /**
   * Đếm số thông báo chưa đọc.
   */
  async countUnread(userId) {
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return total;
  },

  // ── Message templates cho Pet Return Workflow ─────────────────────────────

  async notifyStaffNewReturn(staffUserIds, petName, returnId) {
    for (const sid of staffUserIds) {
      await this.send({
        userId: sid,
        title: "📬 Yêu cầu trả thú cưng mới",
        message: `Có yêu cầu trả lại "${petName}" (Mã hồ sơ: #${returnId}). Vui lòng xem xét và xử lý.`,
        type: NOTIF_TYPES.PET_RETURN_CREATED,
      });
    }
  },

  async notifyUserStatusChange(userId, petName, newStatus, adminNotes) {
    const statusMessages = {
      approved_online: {
        title: "✅ Yêu cầu trả đã được duyệt online",
        message: `Yêu cầu trả "${petName}" đã được chấp thuận. ${adminNotes ? `Ghi chú từ trạm: ${adminNotes}` : "Vui lòng liên hệ trạm để sắp xếp bàn giao thực tế."}`,
      },
      completed: {
        title: "🏡 Bàn giao thú cưng hoàn tất",
        message: `Trạm đã xác nhận nhận lại "${petName}". Cảm ơn bạn đã liên hệ và hợp tác.`,
      },
      rejected: {
        title: "❌ Yêu cầu trả bị từ chối",
        message: `Yêu cầu trả "${petName}" đã bị từ chối. ${adminNotes ? `Lý do: ${adminNotes}` : "Vui lòng liên hệ trạm để được hỗ trợ thêm."}`,
      },
      cancelled: {
        title: "🔄 Yêu cầu trả đã hủy",
        message: `Yêu cầu trả "${petName}" của bạn đã được hủy thành công.`,
      },
    };

    const tpl = statusMessages[newStatus];
    if (tpl) {
      await this.send({
        userId,
        title: tpl.title,
        message: tpl.message,
        type: NOTIF_TYPES.PET_RETURN_UPDATED,
      });
    }
  },
};

module.exports = notificationService;
