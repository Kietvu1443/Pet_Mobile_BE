const express = require("express");
const router = express.Router();
const path = require("path");

const staticPagesRoot = path.join(__dirname, "..", "..", "frontend", "pages");

router.get("/my-adoption-requests", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "my-adoption-requests.html"));
});

router.get("/admin/adoption-requests", (_req, res) => {
  res.sendFile(path.join(staticPagesRoot, "adoption-review.html"));
});

module.exports = router;
