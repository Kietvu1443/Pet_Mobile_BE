const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/apiResponse");
const { JWT_SECRET } = require("./authMiddleware");
const User = require("../models/User");

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

const getUserFromToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const requireApiAuth = async (req, res, next) => {
  const token = getTokenFromRequest(req);
  const decoded = getUserFromToken(token);

  if (!decoded) {
    return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
  }

  // Check user status from DB on every request
  try {
    const freshUser = await User.findById(decoded.id);
    if (!freshUser) {
      return sendError(res, 401, "Tài khoản không tồn tại");
    }
    if (freshUser.status === "banned") {
      return sendError(res, 403, "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
    }
  } catch (error) {
    console.error("[apiAuthV1] DB check error:", error);
    return sendError(res, 500, "Đã xảy ra lỗi xác thực");
  }

  req.user = decoded;
  return next();
};

const requireApiRole = (allowedRoles) => {
  return (req, res, next) => {
    const token = getTokenFromRequest(req);
    const user = req.user || getUserFromToken(token);

    if (!user) {
      return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
    }

    if (!allowedRoles.includes(user.role)) {
      return sendError(res, 403, "Bạn không có quyền truy cập tài nguyên này");
    }

    req.user = user;
    return next();
  };
};

const requireApiVerified = (req, res, next) => {
  const token = getTokenFromRequest(req);
  const user = req.user || getUserFromToken(token);

  if (!user) {
    return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
  }

  if (Number(user.verify) !== 1) {
    return sendError(
      res,
      403,
      "Please verify your account before creating adoption request",
    );
  }

  req.user = user;
  return next();
};

module.exports = {
  requireApiAuth,
  requireApiRole,
  requireApiVerified,
};
