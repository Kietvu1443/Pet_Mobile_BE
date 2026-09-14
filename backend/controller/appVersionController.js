const fs = require("fs");
const path = require("path");
const semver = require("semver");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const UPDATES_DIR = path.join(__dirname, "../config/updates");

const appVersionController = {
  /**
   * GET /api/v1/app/latest-update
   * Query: channel (default: 'production'), runtimeVersion (default: '1.0.0'), currentVersion
   */
  async getLatestUpdate(req, res) {
    try {
      const channel = req.query.channel || "production";
      const runtimeVersion = req.query.runtimeVersion || "1.0.0";
      const currentVersion = req.query.currentVersion;

      if (!fs.existsSync(UPDATES_DIR)) {
        return sendError(res, 404, "Chưa có dữ liệu phiên bản cập nhật");
      }

      const files = fs.readdirSync(UPDATES_DIR).filter((f) => f.endsWith(".json"));
      const updates = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(UPDATES_DIR, file), "utf8");
          const data = JSON.parse(content);
          // Validate semver format
          if (data.version && (semver.valid(data.version) || semver.valid(semver.coerce(data.version)))) {
            updates.push(data);
          }
        } catch (e) {
          console.warn(`[AppVersionController] Error parsing update file ${file}:`, e);
        }
      }

      // Filter by channel and runtimeVersion match (flexible for Expo SDK runtime versions)
      const matchingUpdates = updates.filter(
        (u) =>
          (!u.channel || u.channel === channel || u.channel === "production" || u.channel === "preview" || channel === "production" || channel === "preview") &&
          (!u.runtimeVersion || u.runtimeVersion === "*" || u.runtimeVersion === runtimeVersion || runtimeVersion.startsWith("exposdk:"))
      );

      if (matchingUpdates.length === 0) {
        return sendError(res, 404, "Không có bản cập nhật phù hợp cho phiên bản này");
      }

      // Sort by semver ascending
      matchingUpdates.sort((a, b) => {
        const vA = semver.valid(a.version) ? a.version : (semver.coerce(a.version)?.version || a.version);
        const vB = semver.valid(b.version) ? b.version : (semver.coerce(b.version)?.version || b.version);
        return semver.compare(vA, vB);
      });

      const latest = matchingUpdates[matchingUpdates.length - 1];

      // Nếu client gửi currentVersion: tìm bản cập nhật kế tiếp theo thứ tự log (cập nhật từng phiên bản)
      if (currentVersion) {
        const higherUpdates = matchingUpdates.filter((u) => {
          const v = semver.valid(u.version) ? u.version : (semver.coerce(u.version)?.version || u.version);
          const cur = semver.valid(currentVersion) ? currentVersion : (semver.coerce(currentVersion)?.version || currentVersion);
          return semver.gt(v, cur);
        });

        if (higherUpdates.length === 0) {
          return sendSuccess(res, 200, "Bạn đang sử dụng phiên bản mới nhất", {
            hasUpdate: false,
            currentVersion,
            latestVersion: latest.version,
            releaseDate: latest.releaseDate,
          });
        }

        // Bản cập nhật kế tiếp theo thứ tự log (từng phiên bản)
        const nextUpdate = higherUpdates[0];
        return sendSuccess(res, 200, `Có bản cập nhật mới ${nextUpdate.version}`, {
          ...nextUpdate,
          hasUpdate: true,
          currentVersion,
          latestVersion: latest.version,
          remainingUpdatesCount: higherUpdates.length - 1,
        });
      }

      return sendSuccess(res, 200, "Lấy thông tin phiên bản mới nhất thành công", {
        ...latest,
        hasUpdate: true,
        latestVersion: latest.version,
      });
    } catch (error) {
      console.error("[AppVersionController] getLatestUpdate error:", error);
      return sendError(res, 500, "Lỗi server khi lấy thông tin phiên bản");
    }
  },

  /**
   * POST /api/v1/app/update-applied
   * Body: { updateGroup, runtimeVersion, platform, appliedAt, version }
   */
  async logUpdateApplied(req, res) {
    try {
      const { updateGroup, runtimeVersion, platform, appliedAt, version } = req.body || {};
      console.log(`[OTA Telemetry] Applied update: version=${version || 'unknown'}, group=${updateGroup}, runtime=${runtimeVersion}, platform=${platform}, at=${appliedAt || new Date().toISOString()}`);
      return sendSuccess(res, 200, "Ghi nhận thông tin cập nhật thành công");
    } catch (error) {
      console.error("[AppVersionController] logUpdateApplied error:", error);
      return sendError(res, 500, "Không thể ghi nhận telemetry log");
    }
  },
};

module.exports = appVersionController;
