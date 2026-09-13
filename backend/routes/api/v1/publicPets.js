const express = require("express");
const router = express.Router();
const publicPetApiV1Controller = require("../../../controller/publicPetApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

// Public resolution (No auth required — called by Scanner & Public Web Profile)
router.get("/pets/public/:token", publicPetApiV1Controller.resolvePublicPet);

// Owner QR generation endpoints
router.get("/user-pets/:id/share-qr", requireApiAuth, publicPetApiV1Controller.getUserPetShareQr);
router.get("/pets/:id/share-qr", publicPetApiV1Controller.getShelterPetShareQr);

module.exports = router;
