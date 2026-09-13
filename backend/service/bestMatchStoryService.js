const { pool } = require("../config/db");
const BestMatch = require("../models/BestMatch");
const BestMatchStory = require("../models/BestMatchStory");
const BestMatchEvidence = require("../models/BestMatchEvidence");

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const bestMatchStoryService = {
  async listStories({ bestMatchId, requestingUserId }) {
    const bestMatch = await BestMatch.getById(bestMatchId);
    if (!bestMatch) throw createError(404, "Không tìm thấy Best Match");

    const isOwner = Number(bestMatch.user_id) === Number(requestingUserId);
    if (!isOwner) {
      // Non-owners only ever see public stories. There is no social
      // "connections" graph in this codebase yet, so 'connections'
      // visibility is treated as private for now (extension point).
      return BestMatchStory.listByBestMatch(bestMatchId, { includePrivate: false, publicOnly: true });
    }
    return BestMatchStory.listByBestMatch(bestMatchId, { includePrivate: true, publicOnly: false });
  },

  async createStory({ bestMatchId, userId, title, content, storyDate, visibility, mediaFiles = [] }) {
    const owned = await BestMatch.isOwnedByUser(bestMatchId, userId);
    if (!owned) {
      throw createError(403, "Bạn không có quyền tạo câu chuyện cho Best Match này");
    }

    const trimmedContent = String(content || "").trim();
    if (!trimmedContent) {
      throw createError(400, "Nội dung câu chuyện không được để trống");
    }
    if (trimmedContent.length > 5000) {
      throw createError(400, "Nội dung câu chuyện không được vượt quá 5000 ký tự");
    }

    const allowedVisibility = ["private", "connections", "public"];
    const safeVisibility = allowedVisibility.includes(visibility) ? visibility : "private";

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const storyId = await BestMatchStory.create(
        {
          bestMatchId,
          authorUserId: userId,
          title: title ? String(title).trim().slice(0, 255) : null,
          content: trimmedContent,
          storyDate: storyDate || null,
          visibility: safeVisibility,
        },
        connection,
      );

      if (mediaFiles.length) {
        await BestMatchStory.addMedia(storyId, mediaFiles, connection);
      }

      await BestMatch.registerStoryCreated(bestMatchId, connection);

      // Evidence is created only here, at story creation — never on edit,
      // so evidence never gets double-counted.
      let evidenceAdded = 0;
      await BestMatchEvidence.create(
        {
          bestMatchId,
          evidenceType: "story",
          sourceType: "story",
          sourceId: storyId,
          title: title ? String(title).trim().slice(0, 255) : "Một câu chuyện mới",
          description: null,
          evidenceDate: storyDate || new Date(),
          visibility: safeVisibility,
        },
        connection,
      );
      evidenceAdded += 1;

      if (mediaFiles.length) {
        await BestMatchEvidence.create(
          {
            bestMatchId,
            evidenceType: "story_media",
            sourceType: "story_media",
            sourceId: storyId,
            title: "Ảnh/video kèm theo câu chuyện",
            description: null,
            evidenceDate: storyDate || new Date(),
            visibility: safeVisibility,
          },
          connection,
        );
        evidenceAdded += 1;
      }

      await BestMatch.incrementEvidenceCount(bestMatchId, evidenceAdded, connection);

      await connection.commit();

      const story = await BestMatchStory.getById(storyId);
      const media = await BestMatchStory.listMedia(storyId);
      return { ...story, media };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateStory({ storyId, userId, title, content, storyDate, visibility }) {
    const story = await BestMatchStory.getByIdWithOwner(storyId);
    if (!story || story.status === "deleted") {
      throw createError(404, "Không tìm thấy câu chuyện");
    }
    if (Number(story.best_match_owner_id) !== Number(userId) || Number(story.author_user_id) !== Number(userId)) {
      throw createError(403, "Bạn không có quyền chỉnh sửa câu chuyện này");
    }

    const fields = {};
    if (title !== undefined) fields.title = title ? String(title).trim().slice(0, 255) : null;
    if (content !== undefined) {
      const trimmed = String(content).trim();
      if (!trimmed) throw createError(400, "Nội dung câu chuyện không được để trống");
      if (trimmed.length > 5000) throw createError(400, "Nội dung câu chuyện không được vượt quá 5000 ký tự");
      fields.content = trimmed;
    }
    if (storyDate !== undefined) fields.story_date = storyDate || null;
    if (visibility !== undefined) {
      const allowedVisibility = ["private", "connections", "public"];
      fields.visibility = allowedVisibility.includes(visibility) ? visibility : story.visibility;
    }

    const updated = await BestMatchStory.update(storyId, fields);
    await BestMatch.touchActivity(story.best_match_id);
    const media = await BestMatchStory.listMedia(storyId);
    return { ...updated, media };
  },

  async deleteStory({ storyId, userId }) {
    const story = await BestMatchStory.getByIdWithOwner(storyId);
    if (!story || story.status === "deleted") {
      throw createError(404, "Không tìm thấy câu chuyện");
    }
    if (Number(story.best_match_owner_id) !== Number(userId)) {
      throw createError(403, "Bạn không có quyền xoá câu chuyện này");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await BestMatchStory.softDelete(storyId, connection);
      await BestMatch.registerStoryDeleted(story.best_match_id, connection);

      const removedStoryEvidence = await BestMatchEvidence.deleteBySource(
        story.best_match_id,
        "story",
        storyId,
        connection,
      );
      const removedMediaEvidence = await BestMatchEvidence.deleteBySource(
        story.best_match_id,
        "story_media",
        storyId,
        connection,
      );
      const removedTotal = removedStoryEvidence + removedMediaEvidence;
      if (removedTotal > 0) {
        await BestMatch.decrementEvidenceCount(story.best_match_id, removedTotal, connection);
      }

      await connection.commit();
      return { id: storyId, deleted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = bestMatchStoryService;
