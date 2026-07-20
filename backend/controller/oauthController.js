/**
 * oauthController.js
 * Xử lý đăng nhập & liên kết tài khoản qua Google và Facebook
 */
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const UserConnection = require("../models/UserConnection");
const EmailVerification = require("../models/EmailVerification");
const { Resend } = require("resend");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const resend = new Resend(process.env.RESEND_API_KEY);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tạo JWT và set cookie */
const issueAuthCookie = (res, user) => {
  const token = jwt.sign(
    {
      id: user.id,
      display_name: user.display_name,
      name: user.name,
      email: user.email,
      role: user.role,
      verify: user.verify || 1,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.cookie("token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
};

/** Tạo display_name duy nhất từ email */
const makeUniqueDisplayName = async (base) => {
  const cleaned = base.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80);
  let candidate = cleaned;
  let suffix = 1;
  while (await User.findByDisplayName(candidate)) {
    candidate = `${cleaned}_${suffix++}`;
  }
  return candidate;
};

/** Tìm hoặc tạo user từ OAuth, trả về user object */
const findOrCreateOAuthUser = async (provider, providerId, email, name, avatar) => {
  // 1. Tìm theo provider_id
  let connection = await UserConnection.findByProvider(provider, providerId);
  if (connection) {
    return await User.findById(connection.user_id);
  }

  // 2. Tìm theo email để liên kết tự động
  let user = await User.findByEmail(email);
  if (user) {
    await UserConnection.create(user.id, provider, providerId, email);
    return user;
  }

  // 3. Tạo user mới
  const display_name = await makeUniqueDisplayName(email.split("@")[0]);
  const [result] = await require("../config/db").pool.execute(
    `INSERT INTO users (display_name, name, email, avatar, role, verify) VALUES (?, ?, ?, ?, 2, 1)`,
    [display_name, name, email, avatar || null]
  );
  const newUser = { id: result.insertId, display_name, name, email, role: 2, verify: 1 };
  await UserConnection.create(newUser.id, provider, providerId, email);
  return newUser;
};

// ─── Google Login ─────────────────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return sendError(res, 400, "Thiếu token Google");

    // Verify token phía server (không trust client)
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      return sendError(res, 401, "Token Google không hợp lệ hoặc đã hết hạn");
    }

    const { sub: googleId, email, email_verified, name, picture } = payload;

    if (!email) return sendError(res, 400, "Tài khoản Google không có email");
    if (!email_verified) return sendError(res, 400, "Email tài khoản Google chưa được xác thực");

    const user = await findOrCreateOAuthUser("google", googleId, email, name, picture);
    if (!user) return sendError(res, 500, "Không thể xác thực tài khoản");
    if (user.status === "banned") return sendError(res, 403, "Tài khoản của bạn đã bị khóa.");

    const jwtToken = issueAuthCookie(res, user);
    return sendSuccess(res, 200, "Đăng nhập Google thành công", {
      token: jwtToken,
      user: { id: user.id, display_name: user.display_name, name: user.name, email: user.email, role: user.role, verify: user.verify || 1 },
    });
  } catch (error) {
    console.error("[OAuth] googleLogin error:", error);
    return sendError(res, 500, "Xác thực Google thất bại, vui lòng thử lại");
  }
};

// ─── Facebook Login ───────────────────────────────────────────────────────────
exports.facebookLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return sendError(res, 400, "Thiếu accessToken Facebook");

    // Verify token phía server qua Graph API
    let fbData;
    try {
      const response = await axios.get("https://graph.facebook.com/me", {
        params: {
          fields: "id,name,email,picture.type(large)",
          access_token: accessToken,
        },
        timeout: 8000,
      });
      fbData = response.data;
    } catch (e) {
      return sendError(res, 401, "accessToken Facebook không hợp lệ hoặc đã hết hạn");
    }

    const { id: fbId, name, email, picture } = fbData;
    const avatarUrl = picture?.data?.url || null;

    if (!email) return sendError(res, 400, "Tài khoản Facebook không có email. Vui lòng dùng phương thức đăng nhập khác");

    const user = await findOrCreateOAuthUser("facebook", fbId, email, name, avatarUrl);
    if (!user) return sendError(res, 500, "Không thể xác thực tài khoản");
    if (user.status === "banned") return sendError(res, 403, "Tài khoản của bạn đã bị khóa.");

    const jwtToken = issueAuthCookie(res, user);
    return sendSuccess(res, 200, "Đăng nhập Facebook thành công", {
      token: jwtToken,
      user: { id: user.id, display_name: user.display_name, name: user.name, email: user.email, role: user.role, verify: user.verify || 1 },
    });
  } catch (error) {
    console.error("[OAuth] facebookLogin error:", error);
    return sendError(res, 500, "Xác thực Facebook thất bại, vui lòng thử lại");
  }
};

// ─── Lấy danh sách liên kết của user ─────────────────────────────────────────
exports.getConnections = async (req, res) => {
  try {
    const connections = await UserConnection.findByUserId(req.user.id);
    return sendSuccess(res, 200, "OK", { connections });
  } catch (error) {
    console.error("[OAuth] getConnections error:", error);
    return sendError(res, 500, "Không thể tải danh sách liên kết");
  }
};

// ─── Liên kết Google (khi đã đăng nhập) ─────────────────────────────────────
exports.linkGoogle = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return sendError(res, 400, "Thiếu token Google");

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      return sendError(res, 401, "Token Google không hợp lệ");
    }

    const { sub: googleId, email, email_verified } = payload;
    if (!email_verified) return sendError(res, 400, "Email Google chưa được xác thực");

    // Kiểm tra tài khoản Google này đã liên kết với user khác chưa
    const existing = await UserConnection.findByProvider("google", googleId);
    if (existing && existing.user_id !== req.user.id) {
      return sendError(res, 409, "Tài khoản Google này đã được liên kết với một người dùng khác");
    }
    if (existing && existing.user_id === req.user.id) {
      return sendError(res, 409, "Tài khoản Google này đã được liên kết với tài khoản của bạn");
    }

    await UserConnection.create(req.user.id, "google", googleId, email);
    return sendSuccess(res, 200, "Liên kết tài khoản Google thành công");
  } catch (error) {
    console.error("[OAuth] linkGoogle error:", error);
    return sendError(res, 500, "Không thể liên kết tài khoản Google");
  }
};

// ─── Liên kết Facebook (khi đã đăng nhập) ────────────────────────────────────
exports.linkFacebook = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return sendError(res, 400, "Thiếu accessToken Facebook");

    let fbData;
    try {
      const response = await axios.get("https://graph.facebook.com/me", {
        params: { fields: "id,name,email", access_token: accessToken },
        timeout: 8000,
      });
      fbData = response.data;
    } catch (e) {
      return sendError(res, 401, "accessToken Facebook không hợp lệ");
    }

    const { id: fbId, email } = fbData;
    if (!email) return sendError(res, 400, "Tài khoản Facebook không có email");

    const existing = await UserConnection.findByProvider("facebook", fbId);
    if (existing && existing.user_id !== req.user.id) {
      return sendError(res, 409, "Tài khoản Facebook này đã được liên kết với một người dùng khác");
    }
    if (existing && existing.user_id === req.user.id) {
      return sendError(res, 409, "Tài khoản Facebook này đã được liên kết với tài khoản của bạn");
    }

    await UserConnection.create(req.user.id, "facebook", fbId, email);
    return sendSuccess(res, 200, "Liên kết tài khoản Facebook thành công");
  } catch (error) {
    console.error("[OAuth] linkFacebook error:", error);
    return sendError(res, 500, "Không thể liên kết tài khoản Facebook");
  }
};

// ─── Gửi OTP xác nhận trước khi Unlink ───────────────────────────────────────
exports.unlinkSendOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return sendError(res, 404, "Không tìm thấy người dùng");

    const recentCount = await EmailVerification.countRecentOtps(userId, 10);
    if (recentCount >= 3) return sendError(res, 429, "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.");

    const cooldown = await EmailVerification.checkCooldown(userId, 60);
    if (!cooldown.canSend) return sendError(res, 429, `Vui lòng chờ ${cooldown.waitSeconds} giây trước khi yêu cầu mã OTP mới.`, { waitSeconds: cooldown.waitSeconds });

    await EmailVerification.deleteByUserId(userId);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await EmailVerification.saveOtp(userId, otp, expiresAt);

    const emailResult = await resend.emails.send({
      from: "Pet Helper <noreply@mail.pethelper.app>",
      to: user.email,
      subject: "Xác nhận hủy liên kết tài khoản - Pet Helper",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2b663e;">Pet Helper - Xác nhận hủy liên kết</h2>
          <p>Xin chào <b>${user.name}</b>,</p>
          <p>Bạn đã yêu cầu hủy liên kết tài khoản mạng xã hội. Mã xác nhận của bạn là:</p>
          <div style="background: #fff7ed; border: 2px solid #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ea580c;">${otp}</span>
          </div>
          <p style="color: #666;">Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
          <p style="color: #666;">Nếu bạn không yêu cầu hành động này, hãy bảo mật tài khoản ngay lập tức.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #999;">© Pet Helper - Hỗ Trợ &amp; Bảo Vệ Vật Nuôi</p>
        </div>
      `,
    });

    if (emailResult.error) {
      return sendError(res, 500, `Không thể gửi email: ${emailResult.error.message}`);
    }

    return sendSuccess(res, 200, "Mã OTP đã được gửi tới email của bạn.");
  } catch (error) {
    console.error("[OAuth] unlinkSendOtp error:", error);
    return sendError(res, 500, "Không thể gửi mã OTP. Vui lòng thử lại.");
  }
};

// ─── Hủy liên kết provider (Google/Facebook) ─────────────────────────────────
exports.unlinkProvider = async (req, res) => {
  try {
    const { provider } = req.params;
    const { otp } = req.body;

    if (!["google", "facebook"].includes(provider)) {
      return sendError(res, 400, "Provider không hợp lệ");
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return sendError(res, 400, "Vui lòng nhập mã OTP 6 chữ số");
    }

    const userId = req.user.id;

    // Xác thực OTP
    const record = await EmailVerification.findValidOtp(userId);
    if (!record) return sendError(res, 400, "Mã OTP không tồn tại hoặc đã hết hạn");
    if (record.attempts >= 5) {
      await EmailVerification.deleteByUserId(userId);
      return sendError(res, 429, "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới.");
    }
    if (record.otp !== otp) {
      await EmailVerification.incrementAttempts(record.id);
      const remaining = 4 - record.attempts;
      return sendError(res, 400, `Mã OTP không đúng. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`);
    }

    // Kiểm tra lockout: phải còn ít nhất 1 phương thức đăng nhập khác
    const methods = await UserConnection.countLoginMethods(userId);
    const totalMethods = (methods.hasPassword ? 1 : 0) + methods.connectionCount + methods.passkeyCount;
    if (totalMethods <= 1) {
      return sendError(res, 400, "Không thể hủy liên kết. Bạn phải duy trì ít nhất một phương thức đăng nhập (mật khẩu, mạng xã hội hoặc Passkey).");
    }

    const deleted = await UserConnection.deleteByUserAndProvider(userId, provider);
    if (!deleted) return sendError(res, 404, "Không tìm thấy liên kết này");

    await EmailVerification.deleteByUserId(userId);
    return sendSuccess(res, 200, `Đã hủy liên kết tài khoản ${provider === "google" ? "Google" : "Facebook"} thành công`);
  } catch (error) {
    console.error("[OAuth] unlinkProvider error:", error);
    return sendError(res, 500, "Không thể hủy liên kết. Vui lòng thử lại.");
  }
};
