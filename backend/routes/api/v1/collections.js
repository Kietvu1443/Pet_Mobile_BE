const express = require("express");
const router = express.Router();
const collectionsController = require("../../../controller/collectionsApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/collections/my", requireApiAuth, collectionsController.getMyCollections);
router.post("/collections", requireApiAuth, collectionsController.createCollection);
router.delete("/collections/:id", requireApiAuth, collectionsController.deleteCollection);
router.post("/collections/:id/pets", requireApiAuth, collectionsController.addPetToCollection);
router.delete("/collections/:id/pets/:petId", requireApiAuth, collectionsController.removePetFromCollection);
router.get("/collections/:id/pets", requireApiAuth, collectionsController.getCollectionPets);
router.get("/collections/pet/:petId", requireApiAuth, collectionsController.getPetCollections);

module.exports = router;
