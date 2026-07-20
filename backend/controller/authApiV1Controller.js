const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
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
        password,
        confirmPassword,
        birthday,
        address,
      } = req.body;

      if (!display_name || !name || !email || !password) {
        return sendError(res, 400, "Vui lòng điền đầy đủ thông tin");
      }

      if (password !== confirmPassword) {
        return sendError(res, 400, "Mật khẩu xác nhận không khớp");
      }

      if (password.length < 8) {
        return sendError(res, 400, "Mật khẩu phải có ít nhất 8 ký tự");
      }

      const [existingEmail, existingDisplayName] = await Promise.all([
        User.findByEmail(email),
        User.findByDisplayName(display_name),
      ]);

      if (existingEmail) {
        return sendError(res, 409, "Email này đã được đăng ký");
      }

      if (existingDisplayName) {
        return sendError(res, 409, "Tên đăng nhập này đã được sử dụng");
      }

      const newUser = await User.create({
        display_name,
        name,
        email,
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

      const display_name = String(req.body?.display_name || "").trim();
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();

      if (!display_name || !name || !email) {
        return sendError(res, 400, "Vui lòng điền đầy đủ thông tin");
      }

      if (!EMAIL_REGEX.test(email)) {
        return sendError(res, 400, "Email không đúng định dạng");
      }

      if (display_name.length > MAX_DISPLAY_NAME_LENGTH) {
        return sendError(
          res,
          400,
          `Tên đăng nhập không được vượt quá ${MAX_DISPLAY_NAME_LENGTH} ký tự`,
        );
      }

      if (name.length > MAX_NAME_LENGTH) {
        return sendError(
          res,
          400,
          `Tên hiển thị không được vượt quá ${MAX_NAME_LENGTH} ký tự`,
        );
      }

      if (email.length > MAX_EMAIL_LENGTH) {
        return sendError(
          res,
          400,
          `Email không được vượt quá ${MAX_EMAIL_LENGTH} ký tự`,
        );
      }

      const currentUser = await User.findById(req.user.id);
      if (!currentUser) {
        return sendError(res, 404, "Không tìm thấy người dùng");
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
        User.findByEmail(email),
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

      const currentEmail = String(currentUser.email || "")
        .trim()
        .toLowerCase();
      const isEmailChanged = currentEmail !== email;
      const verify = isEmailChanged ? 0 : Number(currentUser.verify || 0);

      const updatedUser = await User.updateProfile(req.user.id, {
        display_name,
        name,
        email,
        verify,
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
};

module.exports = authApiV1Controller;
