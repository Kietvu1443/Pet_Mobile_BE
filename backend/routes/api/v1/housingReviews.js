const express = require("express");
const router = express.Router();
const ctrl = require("../../../controller/housingReviewApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/housing-reviews/my", requireApiAuth, ctrl.getMyReviews);
router.get("/housing-reviews/active", requireApiAuth, ctrl.getActive);
router.post("/housing-reviews/my", requireApiAuth, ctrl.create);
router.patch("/housing-reviews/my", requireApiAuth, ctrl.update);
router.delete("/housing-reviews/my", requireApiAuth, ctrl.delete);

module.exports = router;
