const express = require("express");
const router = express.Router();
const path = require("path");

const staticPagesRoot = path.join(__dirname, "..", "..", "frontend", "pages");

// Staff/Admin routes (MUST be defined BEFORE /:id route)
// GET - Show add pet form
router.get("/admin/add", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "add-pet.html"));
});

// GET - Show edit pet form
router.get("/admin/edit/:id", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "add-pet.html"));
});

// Public routes (AFTER admin routes)
// LEGACY_UI_SHELL: API-first list page shell
router.get("/", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "adopt.html"));
});

// Compatibility redirect for legacy PetSnap URL
router.get("/petsnap", (_req, res) => {
  res.redirect(302, "/snap");
});

// LEGACY_UI_SHELL: API-first detail page shell (wildcard :id MUST be last)
router.get("/:id", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "adopt-detail.html"));
});

module.exports = router;
