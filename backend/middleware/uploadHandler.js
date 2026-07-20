/**
 * uploadHandler.js
 * Multer instance dành riêng cho ảnh minh chứng trả thú cưng.
 * - Dev:  Lưu local tại frontend/images/returns/
 * - Prod: Đẩy lên Cloudinary thư mục "returns/"
 */
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary, isProduction, getCloudinaryId } = require("../config/upload");

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Local storage ─────────────────────────────────────────────────────────────
const returnUploadDir = path.join(__dirname, "../../frontend/images/returns");
if (!fs.existsSync(returnUploadDir)) {
  fs.mkdirSync(returnUploadDir, { recursive: true });
}

const localReturnStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, returnUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `return_${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// ── Cloudinary storage ────────────────────────────────────────────────────────
const cloudReturnStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "returns",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"],
    transformation: [{ width: 1200, crop: "limit" }],
  },
});

// ── File filter ────────────────────────────────────────────────────────────────
const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|heic|heif/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) || allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp, heic, heif)"), false);
  }
};

// ── Multer instance ────────────────────────────────────────────────────────────
const returnUpload = multer({
  storage: isProduction ? cloudReturnStorage : localReturnStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Middleware: upload tối đa MAX_FILES ảnh trả thú cưng.
 * Trường form-data: "images"
 */
const uploadReturnImages = (req, res, next) => {
  returnUpload.array("images", MAX_FILES)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ success: false, message: `Chỉ được upload tối đa ${MAX_FILES} ảnh` });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "Mỗi ảnh không được vượt quá 5MB" });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

/**
 * Chuyển đổi danh sách req.files thành mảng { path, cloudinaryId }.
 */
const mapUploadedFiles = (files = []) =>
  files.map((file) => ({
    path: isProduction ? file.path : `/images/returns/${file.filename}`,
    cloudinaryId: isProduction ? getCloudinaryId(file) : null,
  }));

module.exports = { uploadReturnImages, mapUploadedFiles };
