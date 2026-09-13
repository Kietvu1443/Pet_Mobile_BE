const express = require("express");
const router = express.Router();
const petSnapApiV1Controller = require("../../../controller/petSnapApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/pet-snap", requireApiAuth, petSnapApiV1Controller.getNext);
router.get("/pet-snap/liked-pets", requireApiAuth, petSnapApiV1Controller.getLikedPets);
router.post("/pet-snap/:id/like", requireApiAuth, petSnapApiV1Controller.like);
router.post("/pet-snap/:id/dislike", requireApiAuth, petSnapApiV1Controller.dislike);
router.post("/pet-snap/:id/super-like", requireApiAuth, petSnapApiV1Controller.superLike);
router.get("/pet-snap/:id/detail-view", requireApiAuth, petSnapApiV1Controller.detailView);
router.post("/pet-snap/:id/unlike", requireApiAuth, petSnapApiV1Controller.unlike);

module.exports = router;
