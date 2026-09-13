const jwt = require("jsonwebtoken");
const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { Resend } = require("resend");
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn(
    "⚠️ RESEND_API_KEY chưa được cấu hình. Chức năng gửi email OTP API v1 sẽ không hoạt động.",
  );
}
const {
  avatarUpload,
  bgUpload,
  getAvatarUrl,
  getBgUrl,
  deleteImage,
} = require("../config/upload");

// Trích xuất Cloudinary public_id từ URL (VD: https://res.cloudinary.com/.../avatars/avatar_1_123.jpg)
// Trả về null nếu không phải URL Cloudinary
const extractCloudinaryId = (url) => {
  if (!url || !url.startsWith("http")) return null;
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.[a-z]+)?$/i);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
};

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{9,15}$/;
const GENDER_VALUES = ["male", "female", "other"];

const authApiV1Controller = {
  async register(req, res) {
    try {
      const {
        display_name,
        name,
        email,
        phone,
        password,
        confirmPassword,
        birthday,
        address,
      } = req.body;

      if (!display_name || !name || (!email && !phone) || !password) {
        return sendError(res, 400, "Vui lòng điền đầy đủ thông tin");
      }

      if (password !== confirmPassword) {
        return sendError(res, 400, "Mật khẩu xác nhận không khớp");
      }

      if (password.length < 8) {
        return sendError(res, 400, "Mật khẩu phải có ít nhất 8 ký tự");
      }

      const [existingDisplayName, existingEmail, existingPhone] =
        await Promise.all([
          User.findByDisplayName(display_name),
          email ? User.findByEmail(email) : null,
          phone ? User.findByPhone(phone) : null,
        ]);

      if (existingDisplayName) {
        return sendError(res, 409, "Tên đăng nhập này đã được sử dụng");
      }

      if (email && existingEmail) {
        return sendError(res, 409, "Email này đã được đăng ký");
      }

      if (phone && existingPhone) {
        return sendError(res, 409, "Số điện thoại này đã được đăng ký");
      }

      const newUser = await User.create({
        display_name,
        name,
        email: email || null,
        phone: phone || null,
        password,
        birthday: birthday || null,
        address: address || null,
      });

      const token = jwt.sign(
        {
          id: newUser.id,
          display_name: newUser.display_name,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          verify: 0,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );

      res.cookie("token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, 201, "Đăng ký thành công", {
        token,
        user: {
          id: newUser.id,
          display_name: newUser.display_name,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          verify: 0,
        },
      });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "Thông tin tài khoản đã tồn tại");
      }

      console.error("[Auth API v1] register error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  // Upload avatar
  uploadAvatar(req, res) {
    avatarUpload.single("avatar")(req, res, async (err) => {
      try {
        if (err) {
          console.error("[Multer Avatar Error]:", err);
          return sendError(res, 400, err.message || "Lỗi upload ảnh");
        }
        if (!req.file) return sendError(res, 400, "Vui lòng chọn ảnh avatar");

        const avatarPath = getAvatarUrl(req.file);

        // Xóa avatar cũ nếu có
        const [[user]] = await require("../config/db").pool.query(
          "SELECT avatar FROM users WHERE id = ?",
          [req.user.id],
        );
        if (user && user.avatar) {
          await deleteImage(user.avatar, extractCloudinaryId(user.avatar));
        }

        await require("../config/db").pool.query(
          "UPDATE users SET avatar = ? WHERE id = ?",
          [avatarPath, req.user.id],
        );

        return sendSuccess(res, 200, "Cập nhật avatar thành công", {
          avatar: avatarPath,
        });
      } catch (error) {
        console.error("[Auth API v1] uploadAvatar error:", error);
        return sendError(res, 500, "Đã xảy ra lỗi");
      }
    });
  },

  // Cập nhật background
  updateBackground(req, res) {
    bgUpload.single("background")(req, res, async (err) => {
      try {
        if (err) {
          console.error("[Multer Background Error]:", err);
          return sendError(res, 400, err.message || "Lỗi upload ảnh");
        }

        let bgValue = null;

        if (req.file) {
          // Upload ảnh background
          bgValue = getBgUrl(req.file);

          // Xóa background ảnh cũ nếu có
          const [[user]] = await require("../config/db").pool.query(
            "SELECT bg_preference FROM users WHERE id = ?",
            [req.user.id],
          );
          if (user && user.bg_preference) {
            await deleteImage(
              user.bg_preference,
              extractCloudinaryId(user.bg_preference),
            );
          }
        } else if (req.body && req.body.bg_color) {
          // Chọn màu
          bgValue = req.body.bg_color;
        } else if (req.body && req.body.reset) {
          // Reset về mặc định
          bgValue = null;
        }

        await require("../config/db").pool.query(
          "UPDATE users SET bg_preference = ? WHERE id = ?",
          [bgValue, req.user.id],
        );

        return sendSuccess(res, 200, "Cập nhật background thành công", {
          bg_preference: bgValue,
        });
      } catch (error) {
        console.error("[Auth API v1] updateBackground error:", error);
        return sendError(res, 500, "Đã xảy ra lỗi");
      }
    });
  },

  async login(req, res) {
    try {
      const { display_name, password } = req.body;

      if (!display_name || !password) {
        return sendError(res, 400, "Vui lòng nhập tên đăng nhập và mật khẩu");
      }

      const user = await User.findByDisplayName(display_name);
      if (!user) {
        return sendError(res, 401, "Tên đăng nhập hoặc mật khẩu bị sai");
      }

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        return sendError(res, 401, "Tên đăng nhập hoặc mật khẩu bị sai");
      }

      // Check if user is banned
      if (user.status === "banned") {
        const reason = user.banned_reason || "Không rõ nguyên nhân";
        return sendError(
          res,
          403,
          `Tài khoản của bạn đã bị khóa. Lý do: ${reason}. Vui lòng liên hệ pethelper@gmail.com.`,
        );
      }

      const token = jwt.sign(
        {
          id: user.id,
          display_name: user.display_name,
          name: user.name,
          email: user.email,
          role: user.role,
          verify: user.verify || 0,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );

      res.cookie("token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, 200, "Đăng nhập thành công", {
        token,
        user: {
          id: user.id,
          display_name: user.display_name,
          name: user.name,
          email: user.email,
          role: user.role,
          verify: user.verify || 0,
        },
      });
    } catch (error) {
      console.error("[Auth API v1] login error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async me(req, res) {
    try {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");

      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const user = await User.findById(req.user.id);
      if (!user) return sendError(res, 404, "Không tìm thấy người dùng");

      return sendSuccess(res, 200, "Lấy thông tin người dùng thành công", {
        user: {
          id: user.id,
          display_name: user.display_name,
          name: user.name,
          email: user.email,
          role: user.role,
          verify: user.verify || 0,
          avatar: user.avatar || null,
          bg_preference: user.bg_preference || null,
          birthday: user.birthday || null,
          gender: user.gender || null,
          phone: user.phone || null,
          address: user.address || null,
          preferences: user.preferences || null,
        },
      });
    } catch (error) {
      console.error("[Auth API v1] me error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async logout(req, res) {
    try {
      res.clearCookie("token");
      return sendSuccess(res, 200, "Đăng xuất thành công");
    } catch (error) {
      console.error("[Auth API v1] logout error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async updateProfile(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const currentUser = await User.findById(req.user.id);
      if (!currentUser) {
        return sendError(res, 404, "Không tìm thấy người dùng");
      }

      const display_name = req.body?.display_name !== undefined
        ? String(req.body.display_name || "").trim()
        : (currentUser.display_name || `user_${req.user.id}`);

      const name = req.body?.name !== undefined
        ? String(req.body.name || "").trim()
        : (currentUser.name || currentUser.display_name || "Người dùng");

      const email = String(req.body?.email || currentUser.email || "")
        .trim()
        .toLowerCase();

      if (!display_name || !name) {
        return sendError(res, 400, "Vui lòng điền đầy đủ Tên đăng nhập và Họ tên");
      }

      // Partial update: merge optional fields with current values
      const birthdayRaw = req.body?.birthday !== undefined
        ? String(req.body.birthday || "").trim()
        : (currentUser.birthday || "");
      // Normalize to YYYY-MM-DD for MySQL DATE column.
      // MySQL2 returns Date objects for DATE columns; client may send ISO strings.
      let birthday = "";
      if (birthdayRaw instanceof Date && !isNaN(birthdayRaw.getTime())) {
        birthday =
          `${birthdayRaw.getFullYear()}-` +
          `${String(birthdayRaw.getMonth() + 1).padStart(2, "0")}-` +
          `${String(birthdayRaw.getDate()).padStart(2, "0")}`;
      } else if (typeof birthdayRaw === "string" && birthdayRaw) {
        birthday = birthdayRaw.split("T")[0];
      }
      const gender = req.body?.gender !== undefined
        ? String(req.body.gender || "").trim().toLowerCase()
        : (currentUser.gender || "");
      const phone = req.body?.phone !== undefined
        ? String(req.body.phone || "").trim()
        : (currentUser.phone || "");
      const address = req.body?.address !== undefined
        ? String(req.body.address || "").trim()
        : (currentUser.address || "");

      // Validate birthday: must be a valid date and not in the future
      if (birthday) {
        const parsedDate = new Date(birthday);
        if (isNaN(parsedDate.getTime())) {
          return sendError(res, 400, "Ngày sinh không đúng định dạng");
        }
        if (parsedDate > new Date()) {
          return sendError(res, 400, "Ngày sinh không được ở tương lai");
        }
      }

      // Validate gender: must be in whitelist or empty
      if (gender && !GENDER_VALUES.includes(gender)) {
        return sendError(res, 400, "Giới tính không hợp lệ (male, female, other)");
      }

      // Validate phone: must match regex or be empty
      if (phone && !PHONE_REGEX.test(phone)) {
        return sendError(res, 400, "Số điện thoại không đúng định dạng");
      }

      const [existingEmail, existingDisplayName] = await Promise.all([
        email ? User.findByEmail(email) : null,
        User.findByDisplayName(display_name),
      ]);

      if (existingEmail && Number(existingEmail.id) !== Number(req.user.id)) {
        return sendError(res, 409, "Email này đã được đăng ký");
      }

      if (
        existingDisplayName &&
        Number(existingDisplayName.id) !== Number(req.user.id)
      ) {
        return sendError(res, 409, "Tên đăng nhập này đã được sử dụng");
      }

      const updatedUser = await User.updateProfile(req.user.id, {
        display_name,
        name,
        email: currentUser.email || null,
        verify: Number(currentUser.verify || 0),
        birthday: birthday || null,
        gender: gender || null,
        phone: phone || null,
        address: address || null,
      });

      if (!updatedUser) {
        return sendError(res, 500, "Không thể cập nhật thông tin tài khoản");
      }

      const token = jwt.sign(
        {
          id: updatedUser.id,
          display_name: updatedUser.display_name,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          verify: updatedUser.verify || 0,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );

      res.cookie("token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, 200, "Cập nhật thông tin tài khoản thành công", {
        user: {
          id: updatedUser.id,
          display_name: updatedUser.display_name,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          verify: updatedUser.verify || 0,
          birthday: updatedUser.birthday || null,
          gender: updatedUser.gender || null,
          phone: updatedUser.phone || null,
          address: updatedUser.address || null,
        },
      });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "Thông tin tài khoản đã tồn tại");
      }

      console.error("[Auth API v1] updateProfile error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  getConfig(req, res) {
    try {
      return sendSuccess(res, 200, "Lấy cấu hình thành công", {
        googleClientId: process.env.GOOGLE_CLIENT_ID || "",
        facebookAppId: process.env.FACEBOOK_APP_ID || "",
      });
    } catch (error) {
      console.error("[Auth API v1] getConfig error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi lấy cấu hình");
    }
  },

  async getScanCount(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }
      const { pool } = require("../config/db");
      const [rows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM pet_scans WHERE user_id = ?",
        [req.user.id],
      );
      return sendSuccess(res, 200, "Lấy số lượt quét thành công", {
        total: rows[0].total,
      });
    } catch (error) {
      console.error("[Auth API v1] getScanCount error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async updatePreferences(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }
      const { preferences } = req.body;
      if (preferences === undefined || preferences === null || typeof preferences !== "object") {
        return sendError(res, 400, "Preferences phải là một object hợp lệ");
      }
      const allowedKeys = ["quickRole", "theme", "language", "pushEnabled", "emailEnabled"];
      const currentUser = await User.findById(req.user.id);
      const existing = currentUser?.preferences || {};
      const merged = { ...existing };
      for (const key of allowedKeys) {
        if (preferences[key] !== undefined) merged[key] = preferences[key];
      }
      await User.updatePreferences(req.user.id, merged);
      const user = await User.findById(req.user.id);
      return sendSuccess(res, 200, "Cập nhật preferences thành công", {
        preferences: user.preferences || null,
      });
    } catch (error) {
      console.error("[Auth API v1] updatePreferences error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi, vui lòng thử lại");
    }
  },

  async sendOtp(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) {
        return sendError(res, 404, "Không tìm thấy người dùng");
      }

      const targetEmail = String(req.body?.email || user.email || "")
        .trim()
        .toLowerCase();

      if (!targetEmail) {
        return sendError(
          res,
          400,
          "Vui lòng nhập địa chỉ email trước khi yêu cầu mã OTP",
        );
      }

      if (!EMAIL_REGEX.test(targetEmail)) {
        return sendError(res, 400, "Email không đúng định dạng");
      }

      const existingUser = await User.findByEmail(targetEmail);
      if (existingUser && Number(existingUser.id) !== Number(userId)) {
        return sendError(res, 409, "Email này đã được đăng ký bởi một tài khoản khác");
      }

      if (user.email === targetEmail && user.verify === 1) {
        return sendError(res, 400, "Email này đã được xác thực trước đó");
      }

      // Check rate limit (max 3 trong 10 phút)
      const recentCount = await EmailVerification.countRecentOtps(userId, 10);
      if (recentCount >= 3) {
        return sendError(
          res,
          429,
          "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
        );
      }

      // Check cooldown (60 giây)
      const cooldown = await EmailVerification.checkCooldown(userId, 60);
      if (!cooldown.canSend) {
        return sendError(
          res,
          429,
          `Vui lòng chờ ${cooldown.waitSeconds} giây trước khi yêu cầu mã OTP mới.`,
          { waitSeconds: cooldown.waitSeconds },
        );
      }

      // Xóa OTP cũ
      await EmailVerification.deleteByUserId(userId);

      // Tạo OTP 6 chữ số
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Lưu vào DB kèm theo targetEmail vào pending_email
      await EmailVerification.saveOtp(userId, otp, expiresAt, targetEmail);

      if (!resend) {
        return sendError(
          res,
          503,
          "Dịch vụ gửi email chưa được cấu hình",
        );
      }

      // Gửi email nếu có Resend API key
      try {
        await resend.emails.send({
          from: "Pet Helper <noreply@mail.pethelper.app>",
          to: targetEmail,
          subject: "Xác minh tài khoản Pet Helper",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #2b663e;">Pet Helper - Xác minh Email</h2>
              <p>Xin chào <b>${user.name}</b>,</p>
              <p>Mã xác minh của bạn là:</p>
              <div style="background: #f0fdf4; border: 2px solid #2b663e; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2b663e;">${otp}</span>
              </div>
              <p style="color: #666;">Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
            </div>
          `,
        });
      } catch (resendErr) {
        console.error("Resend send error:", resendErr);
      }

      console.log(`✅ [API v1] OTP sent to ${targetEmail} (OTP: ${otp})`);
      return sendSuccess(res, 200, "Mã OTP đã được gửi tới email của bạn.", {
        email: targetEmail,
        waitSeconds: 60,
      });
    } catch (error) {
      console.error("[Auth API v1] sendOtp error:", error);
      return sendError(res, 500, "Không thể gửi mã OTP. Vui lòng thử lại.");
    }
  },

  async verifyOtp(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const userId = req.user.id;
      const otp = String(req.body?.otp || "").trim();

      if (!otp || otp.length !== 6) {
        return sendError(res, 400, "Vui lòng nhập đúng mã OTP 6 chữ số.");
      }

      const record = await EmailVerification.findValidOtp(userId);
      if (!record) {
        return sendError(
          res,
          400,
          "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.",
        );
      }

      if (record.attempts >= 5) {
        await EmailVerification.deleteByUserId(userId);
        return sendError(
          res,
          429,
          "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới.",
        );
      }

      if (record.otp !== otp) {
        await EmailVerification.incrementAttempts(record.id);
        const remaining = 4 - record.attempts;
        return sendError(
          res,
          400,
          `Mã OTP không đúng. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`,
        );
      }

      const user = await User.findById(userId);
      if (!user) {
        return sendError(res, 404, "Không tìm thấy người dùng");
      }

      const targetEmail = record.pending_email || user.email;
      if (!targetEmail) {
        return sendError(res, 400, "Không tìm thấy địa chỉ email cần xác minh.");
      }

      // Chỉ cập nhật email và verify = 1 khi OTP chính xác
      const updatedUser = await User.updateEmailAndVerify(userId, targetEmail);

      if (!updatedUser) {
        return sendError(
          res,
          500,
          "Không thể cập nhật thông tin xác thực email.",
        );
      }

      await EmailVerification.deleteByUserId(userId);

      const token = jwt.sign(
        {
          id: updatedUser.id,
          display_name: updatedUser.display_name,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          verify: updatedUser.verify || 0,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );

      res.cookie("token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, 200, "Xác thực email thành công!", {
        token,
        user: {
          id: updatedUser.id,
          display_name: updatedUser.display_name,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          verify: updatedUser.verify || 0,
        },
      });
    } catch (error) {
      console.error("[Auth API v1] verifyOtp error:", error);
      return sendError(res, 500, "Không thể xác nhận OTP. Vui lòng thử lại.");
    }
  },
};

module.exports = authApiV1Controller;
