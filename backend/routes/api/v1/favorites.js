const express = require("express");
const router = express.Router();
const favoritesApiV1Controller = require("../../../controller/favoritesApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.post(
  "/favorites/:petId",
  requireApiAuth,
  favoritesApiV1Controller.addFavorite,
);

router.delete(
  "/favorites/:petId",
  requireApiAuth,
  favoritesApiV1Controller.removeFavorite,
);

router.get(
  "/favorites/my",
  requireApiAuth,
  favoritesApiV1Controller.getMyFavorites,
);

module.exports = router;
