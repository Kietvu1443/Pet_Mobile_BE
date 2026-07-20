const express = require("express");
const router = express.Router();
const authApiV1Controller = require("../../../controller/authApiV1Controller");
const oauthController = require("../../../controller/oauthController");
const passkeyController = require("../../../controller/passkeyController");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

// ── Existing auth endpoints ───────────────────────────────────────────────────
router.get("/config", authApiV1Controller.getConfig);
router.post("/register", authApiV1Controller.register);
router.post("/login", authApiV1Controller.login);
router.post("/logout", authApiV1Controller.logout);
router.get("/me", requireApiAuth, authApiV1Controller.me);
router.get("/scan-count", requireApiAuth, authApiV1Controller.getScanCount);
router.patch("/profile", requireApiAuth, authApiV1Controller.updateProfile);
router.patch("/preferences", requireApiAuth, authApiV1Controller.updatePreferences);
router.post("/avatar", requireApiAuth, authApiV1Controller.uploadAvatar);
router.post("/background", requireApiAuth, authApiV1Controller.updateBackground);

// ── Google / Facebook Login ───────────────────────────────────────────────────
router.post("/google", oauthController.googleLogin);
router.post("/facebook", oauthController.facebookLogin);

// ── Connected Accounts: Link / Unlink ────────────────────────────────────────
router.get("/connections", requireApiAuth, oauthController.getConnections);
router.post("/link/google", requireApiAuth, oauthController.linkGoogle);
router.post("/link/facebook", requireApiAuth, oauthController.linkFacebook);
router.post("/unlink/send-otp", requireApiAuth, oauthController.unlinkSendOtp);
router.delete("/unlink/:provider", requireApiAuth, oauthController.unlinkProvider);

// ── Passkey: Registration ─────────────────────────────────────────────────────
router.get("/passkey/register/options", requireApiAuth, passkeyController.getRegisterOptions);
router.post("/passkey/register/verify", requireApiAuth, passkeyController.verifyRegister);

// ── Passkey: Login (public) ───────────────────────────────────────────────────
router.get("/passkey/login/options", passkeyController.getLoginOptions);
router.post("/passkey/login/verify", passkeyController.verifyLogin);

// ── Passkey: Management (from Profile) ───────────────────────────────────────
router.get("/passkeys", requireApiAuth, passkeyController.listPasskeys);
router.patch("/passkeys/:id", requireApiAuth, passkeyController.renamePasskey);
router.post("/passkeys/delete/send-otp", requireApiAuth, passkeyController.deleteSendOtp);
router.delete("/passkeys/:id", requireApiAuth, passkeyController.deletePasskey);

module.exports = router;

