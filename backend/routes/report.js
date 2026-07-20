const express = require("express");
const path = require("path");
const router = express.Router();
const {
  isAuthenticated,
  requireRole,
} = require("../middleware/authMiddleware");

const reportPage = (fileName) =>
  path.join(__dirname, "..", "..", "frontend", "report", fileName);

const protectedReportPage = (fileName) =>
  path.join(__dirname, "..", "..", "frontend", "static", "report", fileName);

// Static report pages (no EJS render)
router.get("/reports", (req, res) => res.sendFile(reportPage("lost.html")));
router.get("/lost", (req, res) => res.sendFile(reportPage("lost.html")));
router.get("/found", (req, res) => res.sendFile(reportPage("found.html")));
router.get("/tips", (req, res) => res.sendFile(reportPage("tips.html")));
router.get("/sheep", (req, res) => res.sendFile(reportPage("sheep.html")));

// Public feed page
router.get("/reports/list", (req, res) => res.sendFile(reportPage("list.html")));

// User's own reports
router.get("/my-reports", isAuthenticated, (req, res) =>
  res.sendFile(protectedReportPage("my-reports.html")),
);

// ============ ADMIN ROUTES (Staff + Admin only) ============

router.get(
  "/admin/reports",
  isAuthenticated,
  requireRole([0, 1]),
  (req, res) => res.sendFile(protectedReportPage("admin-reports.html")),
);

module.exports = router;
