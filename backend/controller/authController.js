const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const authController = {
  // Xử lí đăng kí
  register: async (req, res) => {
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
        return res.status(400).json({
          error: "Vui lòng điền đầy đủ thông tin",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          error: "Mật khẩu xác nhận không khớp",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: "Mật khẩu phải có ít nhất 8 ký tự",
        });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: "Email này đã được đăng ký",
        });
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

      res.status(201).json({
        message: "Đăng ký thành công",
        token: token,
        user: {
          id: newUser.id,
          display_name: newUser.display_name,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        error: "Đã xảy ra lỗi, vui lòng thử lại",
      });
    }
  },

  // Xử lí đăng nhập
  login: async (req, res) => {
    try {
      const { display_name, password } = req.body;

      if (!display_name || !password) {
        return res.status(400).json({
          error: "Vui lòng nhập tên đăng nhập và mật khẩu",
        });
      }

      const user = await User.findByDisplayName(display_name);
      if (!user) {
        return res.status(401).json({
          error: "Tên đăng nhập hoặc mật khẩu bị sai",
        });
      }

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: "Tên đăng nhập hoặc mật khẩu bị sai",
        });
      }

      // Check if user is banned
      if (user.status === "banned") {
        const reason = user.banned_reason || "Không rõ nguyên nhân";
        return res.status(403).json({
          error: `Tài khoản của bạn đã bị khóa. Lý do: ${reason}. Vui lòng liên hệ pethelper@gmail.com.`,
        });
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

      res.status(200).json({
        message: "Đăng nhập thành công",
        token: token,
        user: {
          id: user.id,
          display_name: user.display_name,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Đã xảy ra lỗi, vui lòng thử lại",
      });
    }
  },

  // Xử lí đăng xuất
  logout: (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Đăng xuất thành công" });
  },

  // ===== OTP: Gửi mã xác thực email =====
  sendOtp: async (req, res) => {
    try {
      const userId = req.user.id;

      // Lấy thông tin user đầy đủ từ DB
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
      }

      // Nếu đã xác thực rồi thì không cần gửi OTP
      if (user.verify === 1) {
        return res.status(400).json({ error: "Email đã được xác thực" });
      }

      // 1. Check rate limit (max 3 trong 10 phút)
      const recentCount = await EmailVerification.countRecentOtps(userId, 10);
      if (recentCount >= 3) {
        return res.status(429).json({
          error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
        });
      }

      // 2. Check cooldown (60 giây)
      const cooldown = await EmailVerification.checkCooldown(userId, 60);
      if (!cooldown.canSend) {
        return res.status(429).json({
          error: `Vui lòng chờ ${cooldown.waitSeconds} giây trước khi yêu cầu mã OTP mới.`,
          waitSeconds: cooldown.waitSeconds,
        });
      }

      // 3. Xóa OTP cũ của user
      await EmailVerification.deleteByUserId(userId);

      // 4. Tạo OTP 6 chữ số
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      // Hết hạn sau 5 phút
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Lưu vào database
      await EmailVerification.saveOtp(userId, otp, expiresAt);

      // 5. Gửi email qua Resend
      const emailResult = await resend.emails.send({
        from: "Pet Helper <noreply@mail.pethelper.app>",
        to: user.email,
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
            <p style="color: #666;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="font-size: 12px; color: #999;">© Pet Helper - Hỗ Trợ & Bảo Vệ Vật Nuôi</p>
          </div>
        `,
      });

      // Log kết quả từ Resend API để debug
      console.log(
        "📧 Resend API response:",
        JSON.stringify(emailResult, null, 2),
      );

      // Kiểm tra nếu Resend trả lỗi
      if (emailResult.error) {
        console.error("❌ Resend API error:", emailResult.error);
        // Vẫn trả success vì OTP đã lưu vào DB, nhưng thông báo lỗi gửi email
        return res.status(500).json({
          error: `Không thể gửi email: ${emailResult.error.message}. Kiểm tra lại cấu hình Resend API.`,
        });
      }

      console.log(
        `✅ OTP sent to ${user.email} (OTP: ${otp} - chỉ log trong dev)`,
      );
      res
        .status(200)
        .json({ message: "Mã OTP đã được gửi tới email của bạn." });
    } catch (error) {
      console.error("Send OTP error:", error);
      res
        .status(500)
        .json({ error: "Không thể gửi mã OTP. Vui lòng thử lại." });
    }
  },

  // ===== OTP: Xác thực mã OTP =====
  verifyOtp: async (req, res) => {
    try {
      const userId = req.user.id;
      const { otp } = req.body;

      if (!otp || otp.length !== 6) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đúng mã OTP 6 chữ số." });
      }

      // Tìm OTP hợp lệ (chưa hết hạn)
      const record = await EmailVerification.findValidOtp(userId);

      if (!record) {
        return res.status(400).json({
          error:
            "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.",
        });
      }

      // 1. Kiểm tra brute force (max 5 lần thử)
      if (record.attempts >= 5) {
        await EmailVerification.deleteByUserId(userId);
        return res.status(429).json({
          error: "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới.",
        });
      }

      // 2. So sánh OTP
      if (record.otp !== otp) {
        await EmailVerification.incrementAttempts(record.id);
        const remaining = 4 - record.attempts;
        return res.status(400).json({
          error: `Mã OTP không đúng. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`,
        });
      }

      // 3. OTP đúng → cập nhật verify = 1
      const isUpdated = await User.updateVerifyStatus(userId, 1);
      if (!isUpdated) {
        return res.status(500).json({
          error: "Không thể cập nhật trạng thái xác thực email.",
        });
      }

      // 4. Xóa OTP khỏi database
      await EmailVerification.deleteByUserId(userId);

      // 5. Re-issue JWT cookie với verify = 1
      const updatedUser = await User.findById(userId);
      if (!updatedUser) {
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
      }

      const newToken = jwt.sign(
        {
          id: updatedUser.id,
          display_name: updatedUser.display_name,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          verify: updatedUser.verify,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );
      res.cookie("token", newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ message: "Xác thực email thành công! 🎉" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." });
    }
  },

  // ===== Quên mật khẩu: Gửi OTP qua email (Public) =====
  forgotPasswordSendOtp: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Vui lòng nhập email." });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        // Trả về thành công giả để tránh lộ thông tin email có tồn tại hay không
        return res
          .status(200)
          .json({ message: "Nếu email tồn tại, mã OTP sẽ được gửi." });
      }

      // Rate limit
      const recentCount = await EmailVerification.countRecentOtps(user.id, 10);
      if (recentCount >= 3) {
        return res.status(429).json({
          error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
        });
      }

      // Cooldown
      const cooldown = await EmailVerification.checkCooldown(user.id, 60);
      if (!cooldown.canSend) {
        return res.status(429).json({
          error: `Vui lòng chờ ${cooldown.waitSeconds} giây trước khi yêu cầu mã OTP mới.`,
          waitSeconds: cooldown.waitSeconds,
        });
      }

      // Xóa OTP cũ & tạo mới
      await EmailVerification.deleteByUserId(user.id);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await EmailVerification.saveOtp(user.id, otp, expiresAt);

      // Gửi email
      const emailResult = await resend.emails.send({
        from: "Pet Helper <noreply@mail.pethelper.app>",
        to: user.email,
        subject: "Đặt lại mật khẩu Pet Helper",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2b663e;">Pet Helper - Đặt lại mật khẩu</h2>
            <p>Xin chào <b>${user.name}</b>,</p>
            <p>Mã xác minh để đặt lại mật khẩu của bạn là:</p>
            <div style="background: #f0fdf4; border: 2px solid #2b663e; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2b663e;">${otp}</span>
            </div>
            <p style="color: #666;">Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
            <p style="color: #666;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="font-size: 12px; color: #999;">© Pet Helper - Hỗ Trợ & Bảo Vệ Vật Nuôi</p>
          </div>
        `,
      });

      if (emailResult.error) {
        console.error("❌ Resend API error:", emailResult.error);
        return res.status(500).json({
          error: `Không thể gửi email: ${emailResult.error.message}.`,
        });
      }

      console.log(
        `✅ Password reset OTP sent to ${user.email} (OTP: ${otp} - chỉ log trong dev)`,
      );
      res
        .status(200)
        .json({ message: "Mã OTP đã được gửi tới email của bạn." });
    } catch (error) {
      console.error("Forgot password send OTP error:", error);
      res
        .status(500)
        .json({ error: "Không thể gửi mã OTP. Vui lòng thử lại." });
    }
  },

  // ===== Quên mật khẩu: Xác minh OTP & đặt lại mật khẩu (Public) =====
  forgotPasswordReset: async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đầy đủ thông tin." });
      }

      if (otp.length !== 6) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đúng mã OTP 6 chữ số." });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res
          .status(400)
          .json({ error: "Email không tồn tại trong hệ thống." });
      }

      const record = await EmailVerification.findValidOtp(user.id);
      if (!record) {
        return res.status(400).json({
          error:
            "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.",
        });
      }

      if (record.attempts >= 5) {
        await EmailVerification.deleteByUserId(user.id);
        return res.status(429).json({
          error: "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới.",
        });
      }

      if (record.otp !== otp) {
        await EmailVerification.incrementAttempts(record.id);
        const remaining = 4 - record.attempts;
        return res.status(400).json({
          error: `Mã OTP không đúng. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`,
        });
      }

      // OTP đúng → cập nhật mật khẩu
      const isUpdated = await User.updatePassword(user.id, newPassword);
      if (!isUpdated) {
        return res.status(500).json({ error: "Không thể cập nhật mật khẩu." });
      }

      await EmailVerification.deleteByUserId(user.id);

      res
        .status(200)
        .json({
          message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.",
        });
    } catch (error) {
      console.error("Forgot password reset error:", error);
      res.status(500).json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." });
    }
  },

  // ===== Đổi mật khẩu bằng mật khẩu cũ (Requires auth) =====
  changePassword: async (req, res) => {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đầy đủ thông tin." });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      }

      // Lấy user có password từ DB
      const user = await User.findByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy người dùng." });
      }

      const isMatch = await User.comparePassword(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Mật khẩu hiện tại không đúng." });
      }

      const isUpdated = await User.updatePassword(userId, newPassword);
      if (!isUpdated) {
        return res.status(500).json({ error: "Không thể cập nhật mật khẩu." });
      }

      res.status(200).json({ message: "Đổi mật khẩu thành công! 🎉" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." });
    }
  },

  // ===== Đổi mật khẩu bằng OTP (Requires auth, quên mật khẩu cũ) =====
  changePasswordWithOtp: async (req, res) => {
    try {
      const userId = req.user.id;
      const { otp, newPassword } = req.body;

      if (!otp || !newPassword) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đầy đủ thông tin." });
      }

      if (otp.length !== 6) {
        return res
          .status(400)
          .json({ error: "Vui lòng nhập đúng mã OTP 6 chữ số." });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      }

      const record = await EmailVerification.findValidOtp(userId);
      if (!record) {
        return res.status(400).json({
          error:
            "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.",
        });
      }

      if (record.attempts >= 5) {
        await EmailVerification.deleteByUserId(userId);
        return res.status(429).json({
          error: "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới.",
        });
      }

      if (record.otp !== otp) {
        await EmailVerification.incrementAttempts(record.id);
        const remaining = 4 - record.attempts;
        return res.status(400).json({
          error: `Mã OTP không đúng. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`,
        });
      }

      // OTP đúng → cập nhật mật khẩu
      const isUpdated = await User.updatePassword(userId, newPassword);
      if (!isUpdated) {
        return res.status(500).json({ error: "Không thể cập nhật mật khẩu." });
      }

      await EmailVerification.deleteByUserId(userId);

      res.status(200).json({ message: "Đổi mật khẩu thành công! 🎉" });
    } catch (error) {
      console.error("Change password with OTP error:", error);
      res.status(500).json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." });
    }
  },

  // ===== Đổi mật khẩu: Gửi OTP qua email cho user đã đăng nhập (Authenticated) =====
  changePasswordSendOtp: async (req, res) => {
    try {
      const userId = req.user.id;

      // Lấy thông tin user đầy đủ từ DB
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
      }

      // 1. Check rate limit (max 3 trong 10 phút)
      const recentCount = await EmailVerification.countRecentOtps(userId, 10);
      if (recentCount >= 3) {
        return res.status(429).json({
          error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
        });
      }

      // 2. Check cooldown (60 giây)
      const cooldown = await EmailVerification.checkCooldown(userId, 60);
      if (!cooldown.canSend) {
        return res.status(429).json({
          error: `Vui lòng chờ ${cooldown.waitSeconds} giây trước khi yêu cầu mã OTP mới.`,
          waitSeconds: cooldown.waitSeconds,
        });
      }

      // 3. Xóa OTP cũ của user
      await EmailVerification.deleteByUserId(userId);

      // 4. Tạo OTP 6 chữ số
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      // Hết hạn sau 5 phút
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Lưu vào database
      await EmailVerification.saveOtp(userId, otp, expiresAt);

      // 5. Gửi email qua Resend
      const emailResult = await resend.emails.send({
        from: "Pet Helper <noreply@mail.pethelper.app>",
        to: user.email,
        subject: "Mã OTP đổi mật khẩu Pet Helper",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2b663e;">Pet Helper - Đổi mật khẩu</h2>
            <p>Xin chào <b>${user.name}</b>,</p>
            <p>Mã OTP để đổi mật khẩu của bạn là:</p>
            <div style="background: #f0fdf4; border: 2px solid #2b663e; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2b663e;">${otp}</span>
            </div>
            <p style="color: #666;">Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
            <p style="color: #666;">Nếu bạn không yêu cầu mã này, vui lòng bảo mật tài khoản của mình.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="font-size: 12px; color: #999;">© Pet Helper - Hỗ Trợ & Bảo Vệ Vật Nuôi</p>
          </div>
        `,
      });

      if (emailResult.error) {
        console.error("Resend API error:", emailResult.error);
        return res.status(500).json({
          error: `Không thể gửi email: ${emailResult.error.message}.`,
        });
      }

      console.log(
        `Password change OTP sent to ${user.email} (OTP: ${otp} - chỉ log trong dev)`,
      );
      res
        .status(200)
        .json({ message: "Mã OTP đã được gửi tới email của bạn." });
    } catch (error) {
      console.error("Change password send OTP error:", error);
      res
        .status(500)
        .json({ error: "Không thể gửi mã OTP. Vui lòng thử lại." });
    }
  },
};

module.exports = authController;
