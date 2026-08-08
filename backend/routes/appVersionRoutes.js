const express = require("express");
const router = express.Router();
const appVersionController = require("../controller/appVersionController");

// Public endpoints for mobile OTA update checks & telemetry
router.get("/latest-update", appVersionController.getLatestUpdate);
router.post("/update-applied", appVersionController.logUpdateApplied);

module.exports = router;
