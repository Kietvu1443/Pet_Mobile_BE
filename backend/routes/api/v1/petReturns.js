const express = require("express");
const router = express.Router();

const petReturnController = require("../../../controller/petReturnController");
const {
  requireApiAuth,
  requireApiRole,
  requireApiVerified,
} = require("../../../middleware/apiAuthV1");
const { uploadReturnImages } = require("../../../middleware/uploadHandler");

// ── User routes ──────────────────────────────────────────────────────────────

// Gửi yêu cầu trả (kèm upload 1-3 ảnh)
router.post(
  "/pet-returns",
  requireApiAuth,
  requireApiVerified,
  uploadReturnImages,
  petReturnController.createReturn,
);

// Xem danh sách yêu cầu trả của cá nhân
router.get(
  "/pet-returns/my",
  requireApiAuth,
  petReturnController.getMyReturns,
);

// ── Admin / Staff routes ─────────────────────────────────────────────────────

// Xem tất cả hồ sơ trả (có filter status, phân trang)
router.get(
  "/pet-returns/admin",
  requireApiAuth,
  requireApiRole([0, 1]),
  petReturnController.getAdminReturns,
);

// ── Shared routes ─────────────────────────────────────────────────────────────

// Chi tiết hồ sơ (User chỉ xem được của mình, Staff/Admin xem tất cả)
router.get(
  "/pet-returns/:id",
  requireApiAuth,
  petReturnController.getReturnById,
);

// Cập nhật trạng thái (Staff/Admin duyệt; User chỉ cancel)
router.patch(
  "/pet-returns/:id/status",
  requireApiAuth,
  petReturnController.updateStatus,
);

// ── Notification routes ───────────────────────────────────────────────────────

router.get(
  "/notifications",
  requireApiAuth,
  petReturnController.getNotifications,
);

router.patch(
  "/notifications/read-all",
  requireApiAuth,
  petReturnController.markNotificationsRead,
);

module.exports = router;
