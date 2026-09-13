const express = require("express");
const router = express.Router();

const bestMatchController = require("../../../controller/bestMatchApiV1Controller");
const {
  requireApiAuth,
  requireApiRole,
} = require("../../../middleware/apiAuthV1");
const { uploadStoryMedia } = require("../../../middleware/bestMatchUploadHandler");

// ── User routes ──────────────────────────────────────────────────────────

router.get("/best-matches", requireApiAuth, bestMatchController.listMine);

router.get("/best-matches/:id", requireApiAuth, bestMatchController.getProfile);

router.post("/best-matches/:id/cancel", requireApiAuth, bestMatchController.cancel);

router.get("/best-matches/:id/privacy", requireApiAuth, bestMatchController.getPrivacy);
router.put("/best-matches/:id/privacy", requireApiAuth, bestMatchController.updatePrivacy);

router.get("/best-matches/:id/stories", requireApiAuth, bestMatchController.listStories);
router.post(
  "/best-matches/:id/stories",
  requireApiAuth,
  uploadStoryMedia,
  bestMatchController.createStory,
);
router.put("/best-matches/:id/stories/:storyId", requireApiAuth, bestMatchController.updateStory);
router.delete("/best-matches/:id/stories/:storyId", requireApiAuth, bestMatchController.deleteStory);

router.get("/best-matches/:id/assessment", requireApiAuth, bestMatchController.getAssessment);

// Owner can view their own signals; staff/admin access is also enforced
// inside the service layer.
router.get(
  "/best-matches/:id/wellbeing-signals",
  requireApiAuth,
  bestMatchController.listWellbeingSignals,
);

// ── Staff / Admin routes ─────────────────────────────────────────────────

router.post(
  "/best-matches/:id/wellbeing-signals",
  requireApiAuth,
  requireApiRole([0, 1]),
  bestMatchController.createWellbeingSignal,
);

router.patch(
  "/best-matches/wellbeing-signals/:signalId/status",
  requireApiAuth,
  requireApiRole([0, 1]),
  bestMatchController.updateWellbeingSignalStatus,
);

router.post(
  "/best-matches/sync/:adoptionRequestId",
  requireApiAuth,
  requireApiRole([0, 1]),
  bestMatchController.syncFromAdoptionRequest,
);

module.exports = router;
