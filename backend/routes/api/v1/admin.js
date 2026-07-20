const express = require("express");
const router = express.Router();
const adminApiV1Controller = require("../../../controller/adminApiV1Controller");
const {
  requireApiAuth,
  requireApiRole,
} = require("../../../middleware/apiAuthV1");

// ============ USER MANAGEMENT ============

// GET /api/v1/admin/users - Admin & Staff can view
router.get(
  "/users",
  requireApiAuth,
  requireApiRole([0, 1]),
  adminApiV1Controller.getUsers,
);

// PATCH /api/v1/admin/users/:id/role - Admin only
router.patch(
  "/users/:id/role",
  requireApiAuth,
  requireApiRole([0]),
  adminApiV1Controller.updateUserRole,
);

// PATCH /api/v1/admin/users/:id/status - Admin only
router.patch(
  "/users/:id/status",
  requireApiAuth,
  requireApiRole([0]),
  adminApiV1Controller.updateUserStatus,
);

// ============ REPORT MANAGEMENT ============

// GET /api/v1/admin/reports - Admin & Staff can view
router.get(
  "/reports",
  requireApiAuth,
  requireApiRole([0, 1]),
  adminApiV1Controller.getReports,
);

// PATCH /api/v1/admin/reports/:id - Admin only (resolve/reject/ban)
router.patch(
  "/reports/:id",
  requireApiAuth,
  requireApiRole([0]),
  adminApiV1Controller.handleReport,
);

// ============ HOUSING REVIEW MANAGEMENT ============

// GET /api/v1/admin/housing-reviews - Admin & Staff can view
router.get(
  "/housing-reviews",
  requireApiAuth,
  requireApiRole([0, 1]),
  adminApiV1Controller.getHousingReviews,
);

// PATCH /api/v1/admin/housing-reviews/:id/status - Admin only
router.patch(
  "/housing-reviews/:id/status",
  requireApiAuth,
  requireApiRole([0]),
  adminApiV1Controller.reviewHousingReview,
);

// ============ SHELTER MANAGEMENT ============

// GET /api/v1/admin/shelters - Admin & Staff can view
router.get(
  "/shelters",
  requireApiAuth,
  requireApiRole([0, 1]),
  adminApiV1Controller.getShelters,
);

// PATCH /api/v1/admin/shelters/:id/status - Admin only
router.patch(
  "/shelters/:id/status",
  requireApiAuth,
  requireApiRole([0]),
  adminApiV1Controller.reviewShelter,
);

module.exports = router;
