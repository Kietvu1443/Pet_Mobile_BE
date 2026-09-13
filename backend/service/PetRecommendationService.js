const { pool } = require("../config/db");
const PetLike = require("../models/PetLike");
const PetInteraction = require("../models/PetInteraction");

class PetRecommendationService {
  /**
   * Lấy thú cưng tiếp theo cho người dùng.
   * READ FALLBACK: Nếu bảng interaction/recommendation chưa tồn tại hoặc engine lỗi,
   * tự động fallback về PetLike.findRandomPets(userId, 1) an toàn tuyệt đối.
   */
  static async getNextPet(userId, sessionId = null) {
    try {
      const hasTable = await PetInteraction.tableExists();
      if (!hasTable) {
        // Fallback trực tiếp khi chưa migrate schema recommendation
        const randomPets = await PetLike.findRandomPets(userId, 1);
        return randomPets[0] || null;
      }

      // 1. Lấy danh sách ứng viên (candidate pool)
      const candidates = await this.getCandidates(userId, 100, sessionId);
      if (!candidates || candidates.length === 0) {
        const randomPets = await PetLike.findRandomPets(userId, 1);
        return randomPets[0] || null;
      }

      // 2. Lấy lịch sử tương tác gần đây
      const recentHistory = await PetInteraction.getRecentUserInteractions(userId, 300);

      // 3. Xây dựng hồ sơ sở thích (Preference Profile)
      const preferenceProfile = this.buildPreferenceProfile(recentHistory);

      // 4. Xếp hạng ứng viên theo điểm phù hợp
      const rankedPets = this.rankCandidates(candidates, preferenceProfile, recentHistory);
      if (!rankedPets || rankedPets.length === 0) {
        return candidates[0] || null;
      }

      // 5. Chính sách chọn (Exploitation vs Exploration)
      const selectedPet = this.selectCandidate(rankedPets, preferenceProfile);
      return selectedPet || rankedPets[0] || candidates[0];
    } catch (error) {
      console.warn("[PetRecommendationService] Recommendation error, falling back to random:", error.message);
      try {
        const randomPets = await PetLike.findRandomPets(userId, 1);
        return randomPets[0] || null;
      } catch (fallbackError) {
        console.error("[PetRecommendationService] Fatal fallback error:", fallbackError.message);
        return null;
      }
    }
  }

  /**
   * Lấy danh sách pet ứng viên (chưa tương tác)
   */
  static async getCandidates(userId, limit = 100, sessionId = null) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
    const query = `
      SELECT
        p.id,
        p.name,
        p.pet_type,
        p.breed,
        p.age,
        p.gender,
        p.color,
        p.weight,
        p.status,
        p.pet_code,
        p.description,
        p.created_at,
        pi.image_path AS avatar_image
      FROM pets p
      LEFT JOIN pet_likes pl
        ON p.id = pl.pet_id AND pl.user_id = ?
      LEFT JOIN pet_images pi
        ON p.id = pi.pet_id AND pi.display_order = 0
      WHERE pl.id IS NULL
        AND p.status = 'available'
      ORDER BY p.id DESC
      LIMIT ${safeLimit}
    `;
    const [rows] = await pool.query(query, [userId]);
    return rows;
  }

  /**
   * Xây dựng hồ sơ sở thích từ lịch sử tương tác
   */
  static buildPreferenceProfile(history) {
    const profile = {
      petTypeScores: {},
      breedScores: {},
      genderScores: {},
      colorScores: {},
      totalInteractions: 0,
      positiveCount: 0,
      negativeCount: 0,
    };

    if (!Array.isArray(history) || history.length === 0) {
      return profile;
    }

    const now = Date.now();

    for (const item of history) {
      profile.totalInteractions++;
      let weight = 0;
      switch (item.interaction_type) {
        case "like":
          weight = 1.0;
          profile.positiveCount++;
          break;
        case "super_like":
          weight = 2.0;
          profile.positiveCount += 2;
          break;
        case "detail_view":
          weight = 0.4;
          break;
        case "pass":
        case "dislike":
          weight = -1.0;
          profile.negativeCount++;
          break;
        default:
          weight = 0;
      }

      if (weight === 0) continue;

      // Time decay: Giảm trọng số theo thời gian (giảm dần về 0.25 sau 90 ngày)
      const ageDays = item.created_at
        ? Math.max(0, (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const recencyMultiplier = Math.max(0.25, Math.exp(-0.015 * ageDays));
      const finalWeight = weight * recencyMultiplier;

      // Cộng dồn điểm thuộc tính
      if (item.pet_type) {
        const key = String(item.pet_type).trim().toLowerCase();
        profile.petTypeScores[key] = (profile.petTypeScores[key] || 0) + finalWeight;
      }
      if (item.breed) {
        const key = String(item.breed).trim().toLowerCase();
        profile.breedScores[key] = (profile.breedScores[key] || 0) + finalWeight;
      }
      if (item.gender) {
        const key = String(item.gender).trim().toLowerCase();
        profile.genderScores[key] = (profile.genderScores[key] || 0) + finalWeight;
      }
      if (item.color) {
        const key = String(item.color).trim().toLowerCase();
        profile.colorScores[key] = (profile.colorScores[key] || 0) + finalWeight;
      }
    }

    return profile;
  }

  /**
   * Xếp hạng danh sách ứng viên
   */
  static rankCandidates(candidates, profile, recentHistory = []) {
    const recentBreeds = (recentHistory || [])
      .slice(0, 10)
      .map((h) => String(h.breed || "").trim().toLowerCase())
      .filter(Boolean);

    return candidates
      .map((pet) => {
        let score = 50; // Điểm cơ sở
        const reasons = [];

        // 1. Điểm loài (Weight: 25)
        const petType = String(pet.pet_type || "").trim().toLowerCase();
        const typeScore = profile.petTypeScores[petType] || 0;
        if (typeScore !== 0) {
          score += Math.max(-20, Math.min(25, typeScore * 5));
          if (typeScore > 1) reasons.push(`Phù hợp sở thích nuôi ${pet.pet_type}`);
        }

        // 2. Điểm giống (Weight: 20)
        const breed = String(pet.breed || "").trim().toLowerCase();
        const breedScore = profile.breedScores[breed] || 0;
        if (breedScore !== 0) {
          score += Math.max(-15, Math.min(20, breedScore * 4));
          if (breedScore > 1) reasons.push(`Cùng giống ${pet.breed} bạn từng quan tâm`);
        }

        // 3. Phạt lặp giống liên tiếp (Diversity Penalty: tối đa -15)
        const repeatCount = recentBreeds.filter((b) => b === breed).length;
        const diversityPenalty = repeatCount * 5;
        score -= diversityPenalty;

        // 4. Điểm mới mẻ (Freshness: tối đa +10)
        const now = Date.now();
        const petAgeDays = pet.created_at
          ? Math.max(0, (now - new Date(pet.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 30;
        if (petAgeDays <= 3) score += 10;
        else if (petAgeDays <= 7) score += 5;

        return {
          ...pet,
          recommendation_score: Math.round(Math.max(0, Math.min(100, score))),
          recommendation_reasons: reasons,
          diversity_penalty: diversityPenalty,
        };
      })
      .sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  /**
   * Chọn ứng viên theo chính sách Exploration vs Exploitation
   */
  static selectCandidate(rankedPets, profile) {
    if (rankedPets.length === 0) return null;

    // Cold start hoặc ít tương tác: Chọn trong Top 3
    if (profile.totalInteractions < 3) {
      const topPool = rankedPets.slice(0, Math.min(3, rankedPets.length));
      return topPool[Math.floor(Math.random() * topPool.length)];
    }

    // Epsilon-Greedy: 20% cơ hội khám phá ngẫu nhiên trong Top 5
    const isExplore = Math.random() < 0.2;
    if (isExplore) {
      const explorePool = rankedPets.slice(0, Math.min(5, rankedPets.length));
      return explorePool[Math.floor(Math.random() * explorePool.length)];
    }

    // 80% Exploitation: Chọn ứng viên điểm cao nhất
    return rankedPets[0];
  }
}

module.exports = PetRecommendationService;
