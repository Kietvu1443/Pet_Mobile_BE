/**
 * BestMatchKnowledgeService.js
 *
 * Extension point for future trusted external knowledge (books, articles,
 * animal welfare research, trusted pet-care sources) that could enrich a
 * Best Match assessment's explanation.
 *
 * Today: returns no external enrichment. Does NOT scrape the internet,
 * does NOT call any AI model, does NOT invent data. This boundary exists
 * so that capability can be added later without reshaping the assessment
 * engine.
 */
const BestMatchKnowledgeService = {
  /**
   * @param {number} bestMatchId
   * @param {object} factors - the current assessment factors (duration, etc.)
   * @returns {Promise<Array>} references to relevant trusted knowledge, if any
   */
  async getRelevantKnowledge(_bestMatchId, _factors) {
    return [];
  },
};

module.exports = BestMatchKnowledgeService;
