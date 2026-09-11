const express = require("express");
const router = express.Router();
const ctrl = require("../../../controller/placeApiV1Controller");
const { requireApiAuth, requireApiRole } = require("../../../middleware/apiAuthV1");
const { upload } = require("../../../config/upload");

// ============ PUBLIC ROUTES ============
// GET /api/v1/places/nearby - Lấy danh sách địa điểm gần tọa độ
router.get("/places/nearby", ctrl.getNearby);

// GET /api/v1/places/:id - Xem chi tiết địa điểm
router.get("/places/:id", ctrl.getDetail);

// GET /api/v1/places/:id/reviews - Lấy danh sách đánh giá
router.get("/places/:id/reviews", ctrl.getReviews);

// ============ AUTHENTICATED USER ROUTES ============
// POST /api/v1/places - Tạo địa điểm mới (kèm upload ảnh tùy chọn)
router.post("/places", requireApiAuth, upload.single("image"), ctrl.create);

// PATCH /api/v1/places/:id - Sửa địa điểm của mình (kèm upload ảnh tùy chọn)
router.patch("/places/:id", requireApiAuth, upload.single("image"), ctrl.update);

// DELETE /api/v1/places/:id - Xóa địa điểm của mình
router.delete("/places/:id", requireApiAuth, ctrl.delete);

// POST /api/v1/places/:id/reviews - Đăng/cập nhật đánh giá
router.post("/places/:id/reviews", requireApiAuth, ctrl.postReview);

// DELETE /api/v1/places/:id/reviews/my - Xóa đánh giá của chính mình
router.delete("/places/:id/reviews/my", requireApiAuth, ctrl.deleteMyReview);

// POST /api/v1/places/:id/report - Báo cáo vi phạm địa điểm hoặc review
router.post("/places/:id/report", requireApiAuth, ctrl.report);

// ============ ADMIN / STAFF MODERATION ROUTES ============
// GET /api/v1/admin/places - Lấy danh sách địa điểm kiểm duyệt
router.get("/admin/places", requireApiAuth, requireApiRole([0, 1]), ctrl.adminGetPlaces);

// PATCH /api/v1/admin/places/:id/status - Duyệt hoặc từ chối địa điểm
router.patch("/admin/places/:id/status", requireApiAuth, requireApiRole([0, 1]), ctrl.adminUpdateStatus);

// DELETE /api/v1/admin/places/:id - Admin xóa địa điểm
router.delete("/admin/places/:id", requireApiAuth, requireApiRole([0]), ctrl.adminDeletePlace);

module.exports = router;
