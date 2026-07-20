/**
 * passkeyController.js
 * Xử lý WebAuthn / Passkey: đăng ký và đăng nhập không cần mật khẩu
 */
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserPasskey = require("../models/UserPasskey");
const UserConnection = require("../models/UserConnection");
const EmailVerification = require("../models/EmailVerification");
const { Resend } = require("resend");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const resend = new Resend(process.env.RESEND_API_KEY);
const rpID = process.env.PASSKEY_RP_ID || "localhost";
const rpName = process.env.PASSKEY_RP_NAME || "Pet Helper";
const origin = process.env.PASSKEY_ORIGIN || "http://localhost:3000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Đăng ký Passkey ──────────────────────────────────────────────────────────

/** GET: Tạo options để bắt đầu đăng ký (yêu cầu user phải đăng nhập) */
exports.getRegisterOptions = async (req, res) => {
  try {
    const user = req.user;
    const existingIds = await UserPasskey.getCredentialIdsForUser(user.id);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(String(user.id)),
      userName: user.email,
      userDisplayName: user.name || user.display_name,
      excludeCredentials: existingIds.map((id) => ({
        id: Buffer.from(id, "base64url"),
        type: "public-key",
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    // Lưu challenge vào session để verify ở bước tiếp theo
    req.session.passkeyChallenge = options.challenge;
    req.session.passkeyChallengeUserId = user.id;

    return sendSuccess(res, 200, "OK", { options });
  } catch (error) {
    console.error("[Passkey] getRegisterOptions error:", error);
    return sendError(res, 500, "Không thể tạo cấu hình đăng ký Passkey");
  }
};

/** POST: Xác thực và lưu Passkey mới */
exports.verifyRegister = async (req, res) => {
  try {
    const user = req.user;
    const { credential, label } = req.body;
    const expectedChallenge = req.session.passkeyChallenge;

    if (!expectedChallenge) {
      return sendError(res, 400, "Phiên đăng ký đã hết hạn, vui lòng thử lại");
    }
    if (req.session.passkeyChallengeUserId !== user.id) {
      return sendError(res, 403, "Không hợp lệ");
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified) {
      return sendError(res, 400, "Xác thực Passkey thất bại");
    }

    const { registrationInfo } = verification;
    const { credential: cred, credentialDeviceType, credentialBackedUp } = registrationInfo;

    const credentialIdB64 = cred.id;
    const publicKeyB64 = Buffer.from(cred.publicKey).toString("base64");

    await UserPasskey.create({
      userId: user.id,
      credentialId: credentialIdB64,
      publicKey: publicKeyB64,
      counter: cred.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports || [],
      label: label || null,
    });

    // Xóa challenge sau khi dùng
    delete req.session.passkeyChallenge;
    delete req.session.passkeyChallengeUserId;

    return sendSuccess(res, 201, "Đăng ký Passkey thành công!");
  } catch (error) {
    console.error("[Passkey] verifyRegister error:", error);
    return sendError(res, 500, "Không thể lưu Passkey. Vui lòng thử lại.");
  }
};

// ─── Đăng nhập bằng Passkey ──────────────────────────────────────────────────

/** GET: Tạo authentication options (public - không cần đăng nhập) */
exports.getLoginOptions = async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      // Không giới hạn allowCredentials = cho phép trình duyệt chọn passkey phù hợp tự động
    });

    req.session.passkeyChallenge = options.challenge;

    return sendSuccess(res, 200, "OK", { options });
  } catch (error) {
    console.error("[Passkey] getLoginOptions error:", error);
    return sendError(res, 500, "Không thể tạo thử thách đăng nhập");
  }
};

/** POST: Xác thực chữ ký Passkey và cấp JWT */
exports.verifyLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    console.log("[Passkey Login] Received req.body:", JSON.stringify(req.body, null, 2));
    const expectedChallenge = req.session.passkeyChallenge;

    if (!expectedChallenge) {
      return sendError(res, 400, "Phiên đăng nhập đã hết hạn, vui lòng thử lại");
    }

    // Tìm passkey trong DB theo credential.id
    const credentialId = credential?.id;
    console.log("[Passkey Login] Received credentialId:", credentialId);
    const dbPasskey = await UserPasskey.findByCredentialId(credentialId);
    console.log("[Passkey Login] Database lookup result dbPasskey:", dbPasskey);
    if (!dbPasskey) {
      return sendError(res, 404, "Passkey này không khớp với bất kỳ tài khoản nào trên hệ thống");
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: Buffer.from(dbPasskey.credential_id, "base64url"),
        publicKey: Buffer.from(dbPasskey.public_key, "base64"),
        counter: Number(dbPasskey.counter),
        transports: dbPasskey.transports ? JSON.parse(dbPasskey.transports) : [],
      },
    });

    if (!verification.verified) {
      return sendError(res, 400, "Xác thực Passkey thất bại");
    }

    // Cập nhật counter để ngăn clone key
    await UserPasskey.updateCounter(dbPasskey.id, verification.authenticationInfo.newCounter);

    const user = await User.findById(dbPasskey.user_id);
    if (!user) return sendError(res, 404, "Không tìm thấy tài khoản");
    if (user.status === "banned") return sendError(res, 403, "Tài khoản của bạn đã bị khóa.");

    delete req.session.passkeyChallenge;

    const token = issueAuthCookie(res, user);
    return sendSuccess(res, 200, "Đăng nhập bằng Passkey thành công", {
      token,
      user: { id: user.id, display_name: user.display_name, name: user.name, email: user.email, role: user.role, verify: user.verify || 1 },
    });
  } catch (error) {
    console.error("[Passkey] verifyLogin error:", error);
    return sendError(res, 500, "Xác thực Passkey thất bại. Vui lòng thử lại.");
  }
};

// ─── Quản lý Passkeys (từ trang Profile) ─────────────────────────────────────

/** GET: Lấy danh sách passkey của user hiện tại */
exports.listPasskeys = async (req, res) => {
  try {
    const passkeys = await UserPasskey.findByUserId(req.user.id);
    return sendSuccess(res, 200, "OK", { passkeys });
  } catch (error) {
    console.error("[Passkey] listPasskeys error:", error);
    return sendError(res, 500, "Không thể tải danh sách Passkeys");
  }
};

/** PATCH: Đổi tên nhãn thiết bị */
exports.renamePasskey = async (req, res) => {
  try {
    const { id } = req.params;
    const { label } = req.body;
    if (!label || !String(label).trim()) return sendError(res, 400, "Tên nhãn không được để trống");

    const updated = await UserPasskey.updateLabel(Number(id), req.user.id, String(label).trim().slice(0, 100));
    if (!updated) return sendError(res, 404, "Không tìm thấy Passkey này");

    return sendSuccess(res, 200, "Đã cập nhật tên thiết bị");
  } catch (error) {
    console.error("[Passkey] renamePasskey error:", error);
    return sendError(res, 500, "Không thể cập nhật tên thiết bị");
  }
};

/** POST: Gửi OTP xác nhận trước khi xóa passkey */
exports.deleteSendOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return sendError(res, 404, "Không tìm thấy người dùng");

    const recentCount = await EmailVerification.countRecentOtps(userId, 10);
    if (recentCount >= 3) return sendError(res, 429, "Bạn đã gửi quá nhiều yêu cầu. Thử lại sau 10 phút.");

    const cooldown = await EmailVerification.checkCooldown(userId, 60);
    if (!cooldown.canSend) return sendError(res, 429, `Vui lòng chờ ${cooldown.waitSeconds} giây.`, { waitSeconds: cooldown.waitSeconds });

    await EmailVerification.deleteByUserId(userId);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await EmailVerification.saveOtp(userId, otp, expiresAt);

    const emailResult = await resend.emails.send({
      from: "Pet Helper <noreply@mail.pethelper.app>",
      to: user.email,
      subject: "Xác nhận xóa Passkey - Pet Helper",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2b663e;">Pet Helper - Xác nhận xóa Passkey</h2>
          <p>Xin chào <b>${user.name}</b>,</p>
          <p>Bạn đã yêu cầu xóa một thiết bị Passkey. Mã xác nhận của bạn là:</p>
          <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626;">${otp}</span>
          </div>
          <p style="color: #666;">Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
          <p style="color: #666;">Nếu bạn không yêu cầu hành động này, hãy bảo mật tài khoản ngay lập tức.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #999;">© Pet Helper - Hỗ Trợ &amp; Bảo Vệ Vật Nuôi</p>
        </div>
      `,
    });

    if (emailResult.error) return sendError(res, 500, "Không thể gửi email xác nhận");

    return sendSuccess(res, 200, "Mã OTP đã được gửi tới email của bạn.");
  } catch (error) {
    console.error("[Passkey] deleteSendOtp error:", error);
    return sendError(res, 500, "Không thể gửi mã OTP. Vui lòng thử lại.");
  }
};

/** DELETE: Xóa passkey sau khi xác minh OTP */
exports.deletePasskey = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp || !/^\d{6}$/.test(otp)) return sendError(res, 400, "Vui lòng nhập mã OTP 6 chữ số");

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

    // Kiểm tra lockout
    const methods = await UserConnection.countLoginMethods(userId);
    const totalMethods = (methods.hasPassword ? 1 : 0) + methods.connectionCount + methods.passkeyCount;
    if (totalMethods <= 1) {
      return sendError(res, 400, "Không thể xóa Passkey cuối cùng. Bạn phải duy trì ít nhất một phương thức đăng nhập khác.");
    }

    const deleted = await UserPasskey.deleteById(Number(id), userId);
    if (!deleted) return sendError(res, 404, "Không tìm thấy Passkey này");

    await EmailVerification.deleteByUserId(userId);
    return sendSuccess(res, 200, "Đã xóa Passkey thành công");
  } catch (error) {
    console.error("[Passkey] deletePasskey error:", error);
    return sendError(res, 500, "Không thể xóa Passkey. Vui lòng thử lại.");
  }
};
