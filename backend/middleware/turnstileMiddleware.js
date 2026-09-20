const { verifyTurnstileToken } = require("../service/turnstileService");

/**
 * Extract Turnstile token from request body or headers.
 * Supports:
 * - req.body.turnstileToken (preferred standard field)
 * - req.body['cf-turnstile-response'] (standard Turnstile form submission)
 * - req.headers['x-turnstile-token']
 * - req.headers['cf-turnstile-response']
 */
function extractToken(req) {
  if (req.body && typeof req.body === "object") {
    if (typeof req.body.turnstileToken === "string" && req.body.turnstileToken.trim()) {
      return req.body.turnstileToken.trim();
    }
    if (typeof req.body["cf-turnstile-response"] === "string" && req.body["cf-turnstile-response"].trim()) {
      return req.body["cf-turnstile-response"].trim();
    }
  }

  const headerToken = req.headers["x-turnstile-token"] || req.headers["cf-turnstile-response"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  return null;
}

/**
 * Extract client IP address safely from request.
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "";
}

/**
 * Check if the request originates from a native mobile client.
 * Identifies mobile platforms via explicit headers or mobile user-agent.
 */
function isMobileClient(req) {
  const platformHeader = (req.headers["x-client-platform"] || req.headers["x-client-type"] || "").toLowerCase();
  if (platformHeader === "mobile" || platformHeader === "react-native" || platformHeader === "expo") {
    return true;
  }

  const userAgent = req.headers["user-agent"] || "";
  // Native mobile networking stacks in React Native / Expo
  if (/okhttp|CFNetwork|Darwin|Expo|PetMobile/i.test(userAgent)) {
    return true;
  }

  // Non-browser client with explicit JSON API call and no browser origin/sec-ch-ua headers
  const isBrowser = req.headers["sec-ch-ua"] || req.headers["origin"] || req.headers["referer"];
  if (!isBrowser && !userAgent.includes("Mozilla")) {
    return true;
  }

  return false;
}

/**
 * Express middleware to enforce Cloudflare Turnstile verification.
 *
 * @param {Object} [options]
 * @param {boolean} [options.enforceMobile] - Override whether mobile clients must supply a token
 */
function requireTurnstile(options = {}) {
  return async (req, res, next) => {
    const token = extractToken(req);
    const shouldEnforceMobile = options.enforceMobile ?? (process.env.TURNSTILE_ENFORCE_MOBILE === "true");
    const mobileRequest = isMobileClient(req);

    // If request is from mobile and mobile enforcement is disabled, allow bypass only if token is absent
    if (mobileRequest && !shouldEnforceMobile && !token) {
      req.turnstile = {
        verified: false,
        bypassed: true,
        reason: "mobile_compatibility",
      };
      return next();
    }

    // Token is required for all web clients or mobile when enforcement is enabled
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực Turnstile không được để trống.",
        error: "Mã xác thực Turnstile không được để trống.",
      });
    }

    const verificationResult = await verifyTurnstileToken({
      token,
      remoteIp: getClientIp(req),
    });

    if (verificationResult.success) {
      req.turnstile = {
        verified: true,
        challengeTs: verificationResult.challengeTs,
        hostname: verificationResult.hostname,
      };
      return next();
    }

    if (verificationResult.networkError) {
      return res.status(503).json({
        success: false,
        message: verificationResult.message || "Hệ thống xác thực bảo mật tạm thời gián đoạn. Vui lòng thử lại sau.",
        error: verificationResult.message || "Hệ thống xác thực bảo mật tạm thời gián đoạn. Vui lòng thử lại sau.",
      });
    }

    return res.status(403).json({
      success: false,
      message: verificationResult.message || "Xác thực Turnstile không hợp lệ hoặc đã hết hạn.",
      error: verificationResult.message || "Xác thực Turnstile không hợp lệ hoặc đã hết hạn.",
    });
  };
}

module.exports = {
  requireTurnstile,
  extractToken,
  isMobileClient,
};
