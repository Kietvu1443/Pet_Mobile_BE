// Authentication Middleware - JWT-based
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "pet-helper-jwt-secret-2026";

// Trích xuất và xác thực JWT từ header Authorization hoặc cookie
const extractUser = (req) => {
  let token = null;

  // 1. Ưu tiên đọc từ header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 2. Nếu không có header thì thử đọc từ cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Check if user is authenticated (dùng cho API)
const isAuthenticated = (req, res, next) => {
  const user = extractUser(req);
  if (user) {
    req.user = user;
    return next();
  }
  return res.status(401).json({ error: "Vui lòng đăng nhập tài khoản" });
};

// Check if user has required role
// Roles: 0 = admin, 1 = staff, 2 = user
const hasRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = extractUser(req);
    if (!user) {
      return res.status(401).json({ error: "Vui lòng đăng nhập" });
    }

    req.user = user;

    if (allowedRoles.includes(user.role)) {
      return next();
    }

    // User doesn't have permission
    return res
      .status(403)
      .json({ error: "Bạn không có quyền truy cập tài nguyên này" });
  };
};

// Check if user is admin
const isAdmin = hasRole([0]);

// Check if user is staff or admin
const isStaff = hasRole([0, 1]);

// Require one of many roles (for admin routes)
const requireRole = (roles) => {
  return (req, res, next) => {
    const user = req.user || extractUser(req);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.user = user;
    next();
  };
};

// Make user available in all views (hỗ trợ cả EJS render lẫn API)
const setUserLocals = (req, res, next) => {
  const user = extractUser(req);
  req.user = user || null;
  res.locals.user = user || null;
  res.locals.isAuthenticated = !!user;
  res.locals.isAdmin = user && user.role === 0;
  res.locals.isStaff = user && user.role <= 1;
  next();
};

// Kiểm tra email đã xác thực chưa (dùng cho adoption guard)
const requireVerified = (req, res, next) => {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({ error: "Vui lòng đăng nhập" });
  }
  req.user = user;
  if (user.verify !== 1) {
    return res.status(403).json({
      message: "Email chưa xác minh. Vui lòng xác minh email trước khi thực hiện hành động này.",
    });
  }
  next();
};

module.exports = {
  isAuthenticated,
  hasRole,
  isAdmin,
  isStaff,
  requireRole,
  requireVerified,
  setUserLocals,
  JWT_SECRET,
};
