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

router.get(
  "/favorites/passed",
  requireApiAuth,
  favoritesApiV1Controller.getMyPassed,
);

router.get(
  "/favorites/superliked",
  requireApiAuth,
  favoritesApiV1Controller.getMySuperliked,
);

router.put(
  "/favorites/:petId/restore",
  requireApiAuth,
  favoritesApiV1Controller.restoreFavorite,
);

router.put(
  "/favorites/:petId/superlike",
  requireApiAuth,
  favoritesApiV1Controller.superlikeFavorite,
);

module.exports = router;
