const express = require("express");
const router = express.Router();
const petApiV1Controller = require("../../../controller/petApiV1Controller");
const { upload } = require("../../../config/upload");
const { sendError } = require("../../../utils/apiResponse");
const { requireApiAuth, requireApiRole } = require("../../../middleware/apiAuthV1");

const handlePetUpload = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return sendError(res, 400, error.message || "Upload ảnh thất bại");
    }
    return next();
  });
};

router.get("/pets", petApiV1Controller.listPets);
router.get("/pets/:id", petApiV1Controller.getPetDetail);

router.post(
  "/pets",
  requireApiAuth,
  requireApiRole([0, 1]),
  handlePetUpload,
  petApiV1Controller.createPet,
);

router.patch(
  "/pets/:id",
  requireApiAuth,
  requireApiRole([0, 1]),
  handlePetUpload,
  petApiV1Controller.updatePet,
);

router.delete(
  "/pets/:id",
  requireApiAuth,
  requireApiRole([0, 1]),
  petApiV1Controller.deletePet,
);

router.post("/pets/:id/like", requireApiAuth, petApiV1Controller.likePet);

module.exports = router;