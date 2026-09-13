/**
 * bestMatchUploadHandler.js
 * Multer instance for voluntary Best Match story media (photos/videos).
 * Follows the same dual local/Cloudinary strategy as
 * middleware/uploadHandler.js (used for pet_returns) — reuses the same
 * `cloudinary` instance from config/upload.js rather than reconfiguring it.
 */
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary, isProduction, getCloudinaryId } = require("../config/upload");

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (allows short videos)

// ── Local storage ────────────────────────────────────────────────────────
const storyUploadDir = path.join(__dirname, "../../frontend/images/best-match-stories");
if (!fs.existsSync(storyUploadDir)) {
  fs.mkdirSync(storyUploadDir, { recursive: true });
}

const localStoryStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, storyUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `story_${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// ── Cloudinary storage (images + videos) ───────────────────────────────────
const cloudStoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "best-match-stories",
    resource_type: "auto", // let Cloudinary detect image vs video
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "mp4", "mov", "webm"],
  },
});

// ── File filter ──────────────────────────────────────────────────────────
const mediaFilter = (_req, file, cb) => {
  const allowedImages = /jpeg|jpg|png|gif|webp|heic|heif/;
  const allowedVideos = /mp4|mov|webm/;
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = allowedImages.test(ext) || file.mimetype.startsWith("image/");
  const isVideo = allowedVideos.test(ext) || file.mimetype.startsWith("video/");

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh hoặc video (jpeg, png, webp, gif, mp4, mov, webm)"), false);
  }
};

const storyUpload = multer({
  storage: isProduction ? cloudStoryStorage : localStoryStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadStoryMedia = (req, res, next) => {
  storyUpload.array("media", MAX_FILES)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ success: false, message: `Chỉ được upload tối đa ${MAX_FILES} ảnh/video` });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "Mỗi file không được vượt quá 25MB" });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

const isVideoFile = (file) =>
  file.mimetype?.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.originalname || "");

/**
 * Converts req.files into the shape BestMatchStory.addMedia expects.
 */
const mapUploadedStoryMedia = (files = []) =>
  files.map((file) => ({
    mediaType: isVideoFile(file) ? "video" : "image",
    path: isProduction ? file.path : `/images/best-match-stories/${file.filename}`,
    cloudinaryId: isProduction ? getCloudinaryId(file) : null,
  }));

module.exports = { uploadStoryMedia, mapUploadedStoryMedia };
