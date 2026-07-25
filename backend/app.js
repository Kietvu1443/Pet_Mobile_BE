require("dotenv").config();
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var fs = require("fs");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
var session = require("express-session");
var rateLimit = require("express-rate-limit");

// Middleware
var { setUserLocals } = require("./middleware/authMiddleware");

// Swagger
var { swaggerUi, swaggerSpec } = require("./config/swagger");


// Routes
var indexRouter = require("./routes/index");
var authRouter = require("./routes/auth");
var authApiV1Router = require("./routes/api/v1/auth");
var petRouter = require("./routes/pet");
var petApiV1Router = require("./routes/api/v1/pets");
var petSnapApiV1Router = require("./routes/api/v1/petSnap");
var favoritesApiV1Router = require("./routes/api/v1/favorites");
var adoptionRequestApiV1Router = require("./routes/api/v1/adoptionRequests");
var adoptionRequestRouter = require("./routes/adoptionRequest");
var reportRouter = require("./routes/report");
var reportApiV1Router = require("./routes/api/v1/reports");
var adminApiV1Router = require("./routes/api/v1/admin");
var newsApiV1Router = require("./routes/api/v1/news");
var petReturnApiV1Router = require("./routes/api/v1/petReturns");
var housingReviewApiV1Router = require("./routes/api/v1/housingReviews");
var shelterApiV1Router = require("./routes/api/v1/shelters");
var deviceApiV1Router = require("./routes/api/v1/devices");
var notificationApiV1Router = require("./routes/api/v1/notifications");

var app = express();

// Middleware
app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../frontend")));

// Session (dùng cho WebAuthn challenge storage)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "pet-helper-session-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" && !process.env.PASSKEY_ORIGIN?.includes("localhost"),
      sameSite: "Lax",
      maxAge: 5 * 60 * 1000, // 5 phút - chỉ dùng để lưu challenge tạm thời
    },
  })
);

// Rate limiting cho các route xác thực (chống brute-force)
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút." },
});
app.use("/api/v1/auth/login", authRateLimiter);
app.use("/api/v1/auth/register", authRateLimiter);
app.use("/api/v1/auth/google", authRateLimiter);
app.use("/api/v1/auth/facebook", authRateLimiter);
app.use("/api/v1/auth/passkey/login", authRateLimiter);

// Make user available in all views (JWT-based)
app.use(setUserLocals);

// Shop route
app.get("/admin-shop", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "pages", "admin-shop.html"));
});

app.use("/api/products", require("./routes/api/v1/products"));
app.use("/api/orders", require("./routes/api/v1/orders"));
app.use("/api/reviews", require("./routes/api/v1/reviews"));

// Route handlers
app.use("/api/v1/auth", authApiV1Router);
app.use("/api/v1/admin", adminApiV1Router);
app.use("/api/v1", reportApiV1Router);
app.use("/api/v1", petApiV1Router);
app.use("/api/v1", petSnapApiV1Router);
app.use("/api/v1", favoritesApiV1Router);
app.use("/api/v1", adoptionRequestApiV1Router);
app.use("/api/v1", petReturnApiV1Router);
app.use("/api/v1", housingReviewApiV1Router);
app.use("/api/v1", shelterApiV1Router);
app.use("/api/v1", deviceApiV1Router);
app.use("/api/v1", notificationApiV1Router);
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/adopt", petRouter);
app.use("/", adoptionRequestRouter);
app.use("/", reportRouter);
app.use("/api/v1", newsApiV1Router);

// Health Check Endpoint - used by deployment workflow for post-deploy verification
app.get("/api/v1/health", (req, res) => {
  let versionInfo = null;
  try {
    const runtimeDir = process.env.RUNTIME_DIR || "/opt/pet-helper/runtime";
    const versionFile = path.join(runtimeDir, "current_version.json");
    if (fs.existsSync(versionFile)) {
      versionInfo = JSON.parse(fs.readFileSync(versionFile, "utf8"));
    }
  } catch (_err) {
    // Non-fatal: version info is optional
  }

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: versionInfo,
  });
});

// Swagger UI Route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  const status = err.status || 500;

  if (
    (req.path || "").startsWith("/api") ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"))
  ) {
    return res.status(status).json({
      success: false,
      message: err.message || "Đã xảy ra lỗi",
    });
  }

  return res
    .status(status)
    .sendFile(path.join(__dirname, "../frontend", "pages", "error.html"));
});

module.exports = app;
