/**
 * BestMatchAssessmentService.js
 *
 * Produces a DESCRIPTIVE snapshot of a Best Match journey — a journey
 * *stage*, not a score. This is not a pass/fail evaluation, does not gate
 * or expire the Best Match, and does not expose any percentage
 * representing compatibility, relationship quality/strength, or amount
 * of proof/activity.
 *
 * assessment_level reflects how long the journey has existed and
 * developed over time. Stories and evidence may still be surfaced as
 * narrative context in `explanation`/`factors`, but they never advance
 * the level themselves — a quiet user with few stories reaches the same
 * stage, at the same pace, as an active storyteller.
 *
 * This is intentionally independent from PetRecommendationService and
 * must never read pet_likes / pet_interactions / pet_recommendations.
 */
const BestMatch = require("../models/BestMatch");
const BestMatchAssessment = require("../models/BestMatchAssessment");
const BestMatchEvidence = require("../models/BestMatchEvidence");
const BestMatchKnowledgeService = require("./BestMatchKnowledgeService");
const BestMatchPatternService = require("./BestMatchPatternService");

const MODEL_VERSION = "descriptive-v2";

// Journey stage is based solely on time elapsed since the official
// adoption (or, if cancelled, time elapsed until cancellation). Story
// count, evidence count, and media are never inputs to this decision.
function levelForDuration(sharedDurationDays) {
  if (sharedDurationDays >= 365) return "long_term";
  if (sharedDurationDays >= 120) return "established";
  if (sharedDurationDays >= 14) return "growing";
  return "early";
}

function explanationForLevel(level, { sharedDurationDays, storyCount }) {
  // Story count is mentioned only as narrative context when present — it
  // never changes which template (i.e. which stage) is chosen.
  const storyMention = storyCount ? ` Bạn đã lưu lại ${storyCount} câu chuyện trong hành trình này.` : "";
  const templates = {
    early: `Hành trình Best Match mới bắt đầu được ${sharedDurationDays} ngày.${storyMention} Đây là giai đoạn đầu — mọi khoảnh khắc bạn muốn lưu lại sẽ tự nhiên bồi đắp thêm theo thời gian.`,
    growing: `Hành trình đã kéo dài ${sharedDurationDays} ngày.${storyMention} Mối quan hệ đang tiếp tục một cách ổn định.`,
    established: `Sau ${sharedDurationDays} ngày cùng nhau,${storyMention} hành trình đã có một nền tảng thời gian đáng kể.`,
    long_term: `Đây là một hành trình lâu dài với ${sharedDurationDays} ngày gắn bó liên tục.${storyMention}`,
  };
  return templates[level] || templates.early;
}

const BestMatchAssessmentService = {
  async assess(bestMatchId) {
    const bestMatch = await BestMatch.getById(bestMatchId);
    if (!bestMatch) return null;

    const sharedDurationDays = (() => {
      const start = new Date(bestMatch.started_at);
      const end = bestMatch.cancelled_at ? new Date(bestMatch.cancelled_at) : new Date();
      return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    })();

    const evidenceCount = await BestMatchEvidence.countByBestMatch(bestMatchId);
    const storyCount = bestMatch.story_count;

    // Contextual only — included so the journey's timeline can be
    // explained, never used to compute the level below.
    const factors = {
      shared_duration_days: sharedDurationDays,
      story_count: storyCount,
      evidence_count: evidenceCount,
    };

    // Extension points for future comparable-pattern / trusted-knowledge
    // enrichment. Today these return no external enrichment — nothing is
    // scraped, invented, or simulated.
    const [knowledge, patterns] = await Promise.all([
      BestMatchKnowledgeService.getRelevantKnowledge(bestMatchId, factors),
      BestMatchPatternService.getComparablePatterns(bestMatchId, factors),
    ]);
    if (knowledge && knowledge.length) factors.knowledge_refs = knowledge;
    if (patterns && patterns.length) factors.pattern_refs = patterns;

    const level = levelForDuration(sharedDurationDays);
    const explanation = explanationForLevel(level, { sharedDurationDays, storyCount });

    await BestMatchAssessment.createSnapshot({
      bestMatchId,
      level,
      explanation,
      factors,
      modelVersion: MODEL_VERSION,
    });

    return { level, explanation, factors };
  },

  // Returns the latest snapshot if one exists and is reasonably fresh;
  // otherwise computes a new one. Keeps profile reads fast without going
  // stale for long-lived Best Matches.
  async getLatestOrAssess(bestMatchId, { maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
    const latest = await BestMatchAssessment.getLatest(bestMatchId);
    if (latest) {
      const age = Date.now() - new Date(latest.assessed_at).getTime();
      if (age < maxAgeMs) {
        return {
          level: latest.assessment_level,
          explanation: latest.explanation,
          factors: typeof latest.factors === "string" ? JSON.parse(latest.factors) : latest.factors,
          assessed_at: latest.assessed_at,
        };
      }
    }
    return this.assess(bestMatchId);
  },

  async getHistory(bestMatchId) {
    return BestMatchAssessment.getHistory(bestMatchId);
  },
};

module.exports = BestMatchAssessmentService;
