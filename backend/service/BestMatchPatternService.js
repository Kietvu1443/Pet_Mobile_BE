/**
 * BestMatchPatternService.js
 *
 * Extension point for future comparisons against patterns seen in other
 * successful, long-term Best Match relationships (using internal data
 * only — never scraped or invented external data).
 *
 * Today: returns no comparable patterns.
 */
const BestMatchPatternService = {
  /**
   * @param {number} bestMatchId
   * @param {object} factors - the current assessment factors
   * @returns {Promise<Array>} comparable internal pattern references, if any
   */
  async getComparablePatterns(_bestMatchId, _factors) {
    return [];
  },
};

module.exports = BestMatchPatternService;
