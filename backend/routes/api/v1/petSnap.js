const express = require("express");
const router = express.Router();
const petSnapApiV1Controller = require("../../../controller/petSnapApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/pet-snap", requireApiAuth, petSnapApiV1Controller.getNext);
router.post("/pet-snap/:id/like", requireApiAuth, petSnapApiV1Controller.like);
router.post("/pet-snap/:id/dislike", requireApiAuth, petSnapApiV1Controller.dislike);

module.exports = router;
