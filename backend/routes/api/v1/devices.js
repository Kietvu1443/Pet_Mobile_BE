const express = require("express");
const router = express.Router();
const ctrl = require("../../../controller/deviceApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.post("/devices", requireApiAuth, ctrl.register);
router.delete("/devices/:token", requireApiAuth, ctrl.unregister);

module.exports = router;
