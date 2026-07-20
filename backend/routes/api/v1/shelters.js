const express = require("express");
const router = express.Router();
const ctrl = require("../../../controller/shelterApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/shelters", requireApiAuth, ctrl.getMyShelter);
router.post("/shelters", requireApiAuth, ctrl.create);
router.patch("/shelters", requireApiAuth, ctrl.update);

module.exports = router;
