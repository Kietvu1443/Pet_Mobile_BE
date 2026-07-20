const express = require("express");
const router = express.Router();
const adoptionRequestApiV1Controller = require("../../../controller/adoptionRequestApiV1Controller");
const {
  requireApiAuth,
  requireApiRole,
  requireApiVerified,
} = require("../../../middleware/apiAuthV1");

router.post(
  "/adoption-requests",
  requireApiAuth,
  requireApiVerified,
  adoptionRequestApiV1Controller.createRequest,
);

router.get(
  "/adoption-requests/my",
  requireApiAuth,
  adoptionRequestApiV1Controller.getMyRequests,
);

router.get(
  "/adoption-requests/admin",
  requireApiAuth,
  requireApiRole([0, 1]),
  adoptionRequestApiV1Controller.getAdminRequests,
);

router.patch(
  "/adoption-requests/:id/status",
  requireApiAuth,
  requireApiRole([0, 1]),
  adoptionRequestApiV1Controller.updateStatus,
);

module.exports = router;
