const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const { isAuthenticated } = require("../middleware/authMiddleware");

// GET - Compatibility redirect for legacy auth page
router.get("/login", (req, res) => {
	return res.redirect("/?auth=login");
});

// POST - Handle registration
router.post("/register", authController.register);

// POST - Handle login
router.post("/login", authController.login);

// GET - Handle logout
router.get("/logout", authController.logout);

// POST - Send OTP for email verification
router.post("/send-otp", isAuthenticated, authController.sendOtp);

// POST - Verify OTP
router.post("/verify-otp", isAuthenticated, authController.verifyOtp);

// POST - Forgot password: send OTP (public)
router.post("/forgot-password/send-otp", authController.forgotPasswordSendOtp);

// POST - Forgot password: reset with OTP (public)
router.post("/forgot-password/reset", authController.forgotPasswordReset);

// POST - Change password with old password (requires auth)
router.post("/change-password", isAuthenticated, authController.changePassword);

// POST - Change password: send OTP (requires auth)
router.post("/change-password/send-otp", isAuthenticated, authController.changePasswordSendOtp);

// POST - Change password with OTP (requires auth)
router.post("/change-password/with-otp", isAuthenticated, authController.changePasswordWithOtp);

module.exports = router;

