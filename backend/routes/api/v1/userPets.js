const express = require("express");
const router = express.Router();
const userPetApiV1Controller = require("../../../controller/userPetApiV1Controller");
const { upload } = require("../../../config/upload");
const { sendError } = require("../../../utils/apiResponse");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

const handleUserPetUpload = (req, res, next) => {
  upload.array("images", 5)(req, res, (error) => {
    if (error) {
      return sendError(res, 400, error.message || "Upload ảnh thất bại");
    }
    return next();
  });
};

// Tất cả endpoints đều yêu cầu đăng nhập (bất kỳ role 0, 1, 2)
router.use("/user-pets", requireApiAuth);

router.get("/user-pets/my", userPetApiV1Controller.getMyPets);
router.get("/user-pets/:id", userPetApiV1Controller.getDetail);
router.post("/user-pets", handleUserPetUpload, userPetApiV1Controller.createPet);
router.patch("/user-pets/:id", handleUserPetUpload, userPetApiV1Controller.updatePet);
router.delete("/user-pets/:id", userPetApiV1Controller.deletePet);

module.exports = router;
