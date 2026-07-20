const express = require("express");
const router = express.Router();
const notificationApiV1Controller = require("../../../controller/notificationApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/notifications", requireApiAuth, notificationApiV1Controller.getNotifications);
router.patch("/notifications/read-all", requireApiAuth, notificationApiV1Controller.markAllRead);

module.exports = router;
