/**
 * Search utilities with fuzzy matching and relevance scoring
 */

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: string;
  indices: [number, number];
  matchedText: string;
}

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  const matrix: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Calculate fuzzy match score (0-1, higher is better)
 */
export function fuzzyMatchScore(query: string, text: string): number {
  if (!query || !text) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 1;

  // Starts with
  if (t.startsWith(q)) return 0.9;

  // Contains as substring
  if (t.includes(q)) return 0.7;

  // Levenshtein similarity
  const distance = levenshteinDistance(q, t);
  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - distance / maxLen;

  return Math.max(0, similarity * 0.5);
}

/**
 * Find all indices of substring in text
 */
export function findIndices(text: string, query: string): [number, number][] {
  const indices: [number, number][] = [];
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let startIndex = 0;
  while ((startIndex = t.indexOf(q, startIndex)) !== -1) {
    indices.push([startIndex, startIndex + q.length]);
    startIndex += q.length;
  }

  return indices;
}

/**
 * Search relevance weights
 */
const RELEVANCE_WEIGHTS = {
  titleExact: 10,
  titleStarts: 8,
  titleContains: 6,
  tagExact: 7,
  tagContains: 4,
  descriptionContains: 3,
  bodyContains: 1,
};

export interface Searchable {
  id: string;
  title: string;
  tags?: string[];
  description?: string;
  promptText?: string;
  category?: string;
  source?: string;
  aliases?: string[];
}

/**
 * Search items with fuzzy matching and relevance scoring
 */
export function searchItems<T extends Searchable>(
  items: T[],
  query: string,
  options?: {
    maxResults?: number;
    threshold?: number;
  },
): SearchResult<T>[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase().trim();
  const maxResults = options?.maxResults ?? 50;
  const threshold = options?.threshold ?? 0.3;

  const results: SearchResult<T>[] = items
    .map((item) => {
      let score = 0;
      const matches: SearchMatch[] = [];

      // Title matching (highest priority)
      const titleScore = fuzzyMatchScore(q, item.title);
      if (titleScore > 0) {
        score += titleScore * RELEVANCE_WEIGHTS.titleContains;
        const indices = findIndices(item.title, q);
        if (indices.length > 0) {
          matches.push({
            field: 'title',
            indices: indices[0],
            matchedText: item.title.slice(indices[0][0], indices[0][1]),
          });
        }
      }

      // Tags matching
      if (item.tags) {
        for (const tag of item.tags) {
          const tagScore = fuzzyMatchScore(q, tag);
          if (tagScore > 0) {
            score += tagScore * RELEVANCE_WEIGHTS.tagContains;
            const indices = findIndices(tag, q);
            if (indices.length > 0) {
              matches.push({
                field: 'tags',
                indices: indices[0],
                matchedText: tag.slice(indices[0][0], indices[0][1]),
              });
            }
          }
        }
      }

      // Description matching
      if (item.description) {
        const descScore = fuzzyMatchScore(q, item.description);
        if (descScore > 0) {
          score += descScore * RELEVANCE_WEIGHTS.descriptionContains;
          const indices = findIndices(item.description, q);
          if (indices.length > 0) {
            matches.push({
              field: 'description',
              indices: indices[0],
              matchedText: item.description.slice(indices[0][0], indices[0][1]),
            });
          }
        }
      }

      // Body text matching (lowest priority)
      if (item.promptText) {
        const bodyScore = fuzzyMatchScore(q, item.promptText);
        if (bodyScore > 0) {
          score += bodyScore * RELEVANCE_WEIGHTS.bodyContains;
        }
      }

      // Aliases
      if (item.aliases) {
        for (const alias of item.aliases) {
          const aliasScore = fuzzyMatchScore(q, alias);
          if (aliasScore > 0) {
            score += aliasScore * RELEVANCE_WEIGHTS.tagContains;
          }
        }
      }

      return { item, score, matches };
    })
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return results;
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(text: string, query: string): string {
  if (!query.trim()) return text;

  const q = query.toLowerCase();
  const regex = new RegExp(`(${q})`, 'gi');

  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Get search history from localStorage
 */
export function getSearchHistory(limit: number = 5): string[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const stored = localStorage.getItem('searchHistory');
    if (!stored) return [];

    const history: Array<{ query: string; timestamp: number }> = JSON.parse(stored);
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map((item) => item.query);
  } catch {
    return [];
  }
}

/**
 * Save search query to history
 */
export function saveSearchQuery(query: string) {
  if (typeof localStorage === 'undefined' || !query.trim()) return;

  try {
    const stored = localStorage.getItem('searchHistory') ?? '[]';
    let history: Array<{ query: string; timestamp: number }> = JSON.parse(stored);

    // Remove duplicate if exists
    history = history.filter((item) => item.query !== query);

    // Add new query
    history.push({ query, timestamp: Date.now() });

    // Keep only last 20
    history = history.slice(-20);

    localStorage.setItem('searchHistory', JSON.stringify(history));
  } catch {
    // Silently fail
  }
}

/**
 * Clear search history
 */
export function clearSearchHistory() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('searchHistory');
}
