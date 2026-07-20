const express = require("express");
const router  = express.Router();
const newsApiV1Controller = require("../../../controller/newsApiV1Controller");
const { upload } = require("../../../config/upload");
const { sendError } = require("../../../utils/apiResponse");
const {
  requireApiAuth,
  requireApiRole,
} = require("../../../middleware/apiAuthV1");

// Middleware upload ảnh cho bài tin
const handleNewsUpload = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return sendError(res, 400, error.message || "Upload ảnh thất bại.");
    }
    return next();
  });
};

// ===== PUBLIC =====
router.get("/news",              newsApiV1Controller.getPublicNews);
router.get("/news/featured",     newsApiV1Controller.getFeaturedNews);

// ===== AUTH REQUIRED (specific routes BEFORE /:id) =====
router.post("/news",                          requireApiAuth, handleNewsUpload, newsApiV1Controller.submitNews);
router.get("/news/my",                        requireApiAuth, newsApiV1Controller.getMyNews);
router.get("/news/followed",                  requireApiAuth, newsApiV1Controller.getMyFollowedNews);
router.post("/news/comments/:commentId/like", requireApiAuth, newsApiV1Controller.toggleCommentLike);

// ===== ROUTES WITH :id (must be AFTER specific routes) =====
router.get("/news/:id",          newsApiV1Controller.getNewsById);
router.get("/news/:id/comments", newsApiV1Controller.getComments);
router.post("/news/:id/comments",             requireApiAuth, newsApiV1Controller.addComment);
router.post("/news/:id/like",                 requireApiAuth, newsApiV1Controller.toggleNewsLike);
router.post("/news/:id/follow",               requireApiAuth, newsApiV1Controller.toggleFollow);

// ===== ADMIN/STAFF ONLY =====
router.get("/admin/news",           requireApiAuth, requireApiRole([0, 1]), newsApiV1Controller.getAdminNews);
router.patch("/admin/news/:id/status", requireApiAuth, requireApiRole([0, 1]), newsApiV1Controller.updateNewsStatus);
router.delete("/admin/news/:id",    requireApiAuth, requireApiRole([0, 1]), newsApiV1Controller.deleteNews);

module.exports = router;
