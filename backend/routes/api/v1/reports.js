const express = require("express");
const router = express.Router();
const reportApiV1Controller = require("../../../controller/reportApiV1Controller");
const { upload } = require("../../../config/upload");
const { sendError } = require("../../../utils/apiResponse");
const {
  requireApiAuth,
  requireApiRole,
} = require("../../../middleware/apiAuthV1");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch (error) {
  rateLimit = null;
}

const reportSubmitLimiter = rateLimit
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: {
        success: false,
        message: "Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.",
        data: null,
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next();

const handleReportUpload = (req, res, next) => {
  upload.array("images", 10)(req, res, (error) => {
    if (error) {
      return sendError(res, 400, error.message || "Upload ảnh thất bại. Vui lòng thử lại.");
    }
    return next();
  });
};

router.post("/reports", reportSubmitLimiter, handleReportUpload, reportApiV1Controller.submitReport);
router.get("/reports", reportApiV1Controller.getPublicReports);
router.get("/reports/my", requireApiAuth, reportApiV1Controller.getMyReports);

router.get(
  "/admin/reports",
  requireApiAuth,
  requireApiRole([0, 1]),
  reportApiV1Controller.getAdminReports,
);

router.patch(
  "/admin/reports/:id/status",
  requireApiAuth,
  requireApiRole([0, 1]),
  reportApiV1Controller.updateReportStatus,
);

router.patch(
  "/admin/reports/:id/revert",
  requireApiAuth,
  requireApiRole([0, 1]),
  reportApiV1Controller.revertReport,
);

router.delete(
  "/admin/reports/:id",
  requireApiAuth,
  requireApiRole([0, 1]),
  reportApiV1Controller.deleteReport,
);

module.exports = router;
