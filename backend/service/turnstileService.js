const axios = require("axios");

const CLOUDFLARE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 10000;

const CF_TEST_SITE_KEY = "1x00000000000000000000AA";
const CF_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * Get environment-appropriate Turnstile credentials.
 * When TURNSTILE_USE_TEST_KEYS is "true" or NODE_ENV is "development",
 * uses Cloudflare's official dummy test keys for localhost development.
 * In production, reads CLOUDFLARE_TURNSTILE_SITE_KEY and CLOUDFLARE_TURNSTILE_SECRET_KEY.
 */
function getTurnstileCredentials() {
  const useTestKeys =
    process.env.TURNSTILE_USE_TEST_KEYS === "true" ||
    process.env.NODE_ENV === "development";

  return {
    siteKey: useTestKeys
      ? CF_TEST_SITE_KEY
      : process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || "",
    secretKey: useTestKeys
      ? CF_TEST_SECRET_KEY
      : process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "",
    isTestMode: useTestKeys,
  };
}

/**
 * Verify Cloudflare Turnstile token server-side via Siteverify API.
 *
 * @param {Object} params
 * @param {string} params.token - The Turnstile token sent by client
 * @param {string} [params.remoteIp] - Client IP address (optional)
 * @param {string} [params.secretKey] - Override secret key
 * @returns {Promise<{ success: boolean, challengeTs?: string, hostname?: string, errorCodes?: string[], error?: string, message?: string, networkError?: boolean }>}
 */
async function verifyTurnstileToken({ token, remoteIp, secretKey } = {}) {
  const credentials = getTurnstileCredentials();
  const secret = secretKey || credentials.secretKey;

  if (!secret) {
    console.error("[TurnstileService] CLOUDFLARE_TURNSTILE_SECRET_KEY is not configured in environment.");
    return {
      success: false,
      error: "CONFIG_ERROR",
      message: "Cấu hình xác thực bảo mật chưa sẵn sàng trên máy chủ.",
    };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      error: "MISSING_TOKEN",
      message: "Mã xác thực Turnstile không được để trống.",
    };
  }

  // In test mode, simulate explicit failure when test token is official Cloudflare fail token
  if (
    credentials.isTestMode &&
    (token.trim() === "2x00000000000000000000AA" || token.trim().startsWith("invalid_"))
  ) {
    return {
      success: false,
      error: "VERIFICATION_FAILED",
      errorCodes: ["invalid-input-response"],
      message: "Xác thực Turnstile không hợp lệ hoặc đã hết hạn.",
    };
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token.trim());
    if (remoteIp) {
      params.append("remoteip", remoteIp);
    }

    const response = await axios.post(CLOUDFLARE_SITEVERIFY_URL, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: VERIFY_TIMEOUT_MS,
    });

    const data = response.data;

    if (data && data.success === true) {
      return {
        success: true,
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
      };
    }

    return {
      success: false,
      error: "VERIFICATION_FAILED",
      errorCodes: (data && data["error-codes"]) || [],
      message: "Xác thực Turnstile không hợp lệ hoặc đã hết hạn.",
    };
  } catch (err) {
    // IMPORTANT: Never log request config or payload which contains the Secret Key
    const safeErrorMessage = err.message || "Unknown error";
    console.error("[TurnstileService] Siteverify network/API error:", safeErrorMessage);

    return {
      success: false,
      error: "NETWORK_ERROR",
      networkError: true,
      message: "Hệ thống xác thực bảo mật tạm thời gián đoạn. Vui lòng thử lại sau.",
    };
  }
}

module.exports = {
  verifyTurnstileToken,
  getTurnstileCredentials,
  CF_TEST_SITE_KEY,
  CF_TEST_SECRET_KEY,
  CLOUDFLARE_SITEVERIFY_URL,
};
