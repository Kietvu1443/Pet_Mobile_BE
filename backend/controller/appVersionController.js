const fs = require("fs");
const path = require("path");
const semver = require("semver");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const UPDATES_DIR = path.join(__dirname, "../config/updates");

const appVersionController = {
  /**
   * GET /api/v1/app/latest-update
   * Query: channel (default: 'production'), runtimeVersion (default: '1.0.0')
   */
  async getLatestUpdate(req, res) {
    try {
      const channel = req.query.channel || "production";
      const runtimeVersion = req.query.runtimeVersion || "1.0.0";

      if (!fs.existsSync(UPDATES_DIR)) {
        return sendError(res, 404, "Chưa có dữ liệu phiên bản cập nhật");
      }

      const files = fs.readdirSync(UPDATES_DIR).filter((f) => f.endsWith(".json"));
      const updates = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(UPDATES_DIR, file), "utf8");
          const data = JSON.parse(content);
          // Standardize version using semver if valid
          if (data.version && semver.valid(semver.coerce(data.version))) {
            updates.push(data);
          }
        } catch (e) {
          console.warn(`[AppVersionController] Error parsing update file ${file}:`, e);
        }
      }

      // Filter by channel and exact runtimeVersion match
      const matchingUpdates = updates.filter(
        (u) =>
          u.channel === channel &&
          (u.runtimeVersion === runtimeVersion || !u.runtimeVersion)
      );

      if (matchingUpdates.length === 0) {
        return sendError(res, 404, "Không có bản cập nhật phù hợp cho phiên bản này");
      }

      // Sort by semver descending
      matchingUpdates.sort((a, b) => {
        const vA = semver.coerce(a.version)?.version || a.version;
        const vB = semver.coerce(b.version)?.version || b.version;
        return semver.rcompare(vA, vB);
      });

      const latest = matchingUpdates[0];
      return sendSuccess(res, 200, "Lấy thông tin phiên bản mới nhất thành công", latest);
    } catch (error) {
      console.error("[AppVersionController] getLatestUpdate error:", error);
      return sendError(res, 500, "Lỗi server khi lấy thông tin phiên bản");
    }
  },

  /**
   * POST /api/v1/app/update-applied
   * Body: { updateGroup, runtimeVersion, platform, appliedAt }
   */
  async logUpdateApplied(req, res) {
    try {
      const { updateGroup, runtimeVersion, platform, appliedAt } = req.body || {};
      console.log(`[OTA Telemetry] Applied update: group=${updateGroup}, runtime=${runtimeVersion}, platform=${platform}, at=${appliedAt || new Date().toISOString()}`);
      return sendSuccess(res, 200, "Ghi nhận thông tin cập nhật thành công");
    } catch (error) {
      console.error("[AppVersionController] logUpdateApplied error:", error);
      return sendError(res, 500, "Không thể ghi nhận telemetry log");
    }
  },
};

module.exports = appVersionController;
