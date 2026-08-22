/**
 * Intelligent recommendation engine
 * Based on copy count, favorites, category, and user behavior
 */

export interface Prompt {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  promptText: string;
  source: string;
  recoveryStatus: string;
  aliases: string[];
  featured: boolean;
  favorite: boolean;
  archived: boolean;
  copyCount: number;
  lastCopiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Recommendation {
  prompt: Prompt;
  score: number;
  reason: string;
}

/**
 * Get recommended prompts based on current prompt
 */
export function getRelatedPrompts(
  currentPrompt: Prompt,
  allPrompts: Prompt[],
  options?: {
    limit?: number;
    excludeFavorites?: boolean;
  },
): Recommendation[] {
  const limit = options?.limit ?? 4;
  const excludeFavorites = options?.excludeFavorites ?? false;

  const recommendations: Recommendation[] = allPrompts
    .filter((p) => p.id !== currentPrompt.id && !p.archived)
    .filter((p) => !excludeFavorites || !p.favorite)
    .map((prompt) => {
      let score = 0;
      let reason = '';

      // Same category bonus
      if (prompt.category === currentPrompt.category) {
        score += 2;
        reason = 'Same category';
      }

      // Shared tags bonus
      const sharedTags = prompt.tags.filter((tag) =>
        currentPrompt.tags.includes(tag),
      ).length;
      if (sharedTags > 0) {
        score += sharedTags * 1.5;
        if (!reason) reason = `${sharedTags} shared tag${sharedTags > 1 ? 's' : ''}`;
      }

      // Popular in category bonus
      const categoryPrompts = allPrompts.filter((p) => p.category === currentPrompt.category);
      const avgCopyCount =
        categoryPrompts.reduce((sum, p) => sum + p.copyCount, 0) / Math.max(categoryPrompts.length, 1);

      if (prompt.copyCount > avgCopyCount) {
        score += 1;
        if (!reason) reason = 'Popular in category';
      }

      // Featured bonus
      if (prompt.featured) {
        score += 1.5;
        if (!reason) reason = 'Featured';
      }

      // Recently updated bonus
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(prompt.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceUpdate < 30) {
        score += 0.5;
        if (!reason) reason = 'Recently updated';
      }

      return { prompt, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return recommendations;
}

/**
 * Get most copied prompts
 */
export function getMostCopiedPrompts(
  allPrompts: Prompt[],
  options?: {
    limit?: number;
    categoryFilter?: string;
  },
): Recommendation[] {
  const limit = options?.limit ?? 5;
  const category = options?.categoryFilter;

  const filtered = category
    ? allPrompts.filter((p) => p.category === category && !p.archived)
    : allPrompts.filter((p) => !p.archived);

  return filtered
    .map((prompt) => ({
      prompt,
      score: prompt.copyCount,
      reason: `${prompt.copyCount} copies`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get user's favorite prompts
 */
export function getFavoritePrompts(allPrompts: Prompt[]): Recommendation[] {
  return allPrompts
    .filter((p) => p.favorite && !p.archived)
    .map((prompt) => ({
      prompt,
      score: prompt.copyCount,
      reason: 'Your favorite',
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Get recently added prompts
 */
export function getRecentlyAddedPrompts(
  allPrompts: Prompt[],
  options?: {
    limit?: number;
    dayLimit?: number;
  },
): Recommendation[] {
  const limit = options?.limit ?? 5;
  const dayLimit = options?.dayLimit ?? 30;

  const cutoffDate = new Date(Date.now() - dayLimit * 24 * 60 * 60 * 1000);

  return allPrompts
    .filter((p) => !p.archived && new Date(p.createdAt) > cutoffDate)
    .map((prompt) => ({
      prompt,
      score: new Date(prompt.createdAt).getTime(),
      reason: 'Recently added',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get prompts that share tags with a favorite
 */
export function getTagBasedRecommendations(
  favorites: Prompt[],
  allPrompts: Prompt[],
  options?: {
    limit?: number;
  },
): Recommendation[] {
  const limit = options?.limit ?? 6;
  const allFavoriteTags = new Set(favorites.flatMap((p) => p.tags));

  const recommendations: Recommendation[] = allPrompts
    .filter((p) => !p.archived && !p.favorite)
    .map((prompt) => {
      const sharedTags = prompt.tags.filter((tag) => allFavoriteTags.has(tag)).length;

      return {
        prompt,
        score: sharedTags,
        reason: sharedTags > 0 ? `Matches ${sharedTags} tag${sharedTags > 1 ? 's' : ''} you like` : '',
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return recommendations;
}

/**
 * Get trending prompts (recently copied)
 */
export function getTrendingPrompts(
  allPrompts: Prompt[],
  options?: {
    limit?: number;
    dayLimit?: number;
  },
): Recommendation[] {
  const limit = options?.limit ?? 5;
  const dayLimit = options?.dayLimit ?? 7;

  const cutoffDate = new Date(Date.now() - dayLimit * 24 * 60 * 60 * 1000);

  return allPrompts
    .filter((p) => !p.archived && p.lastCopiedAt && new Date(p.lastCopiedAt) > cutoffDate)
    .map((prompt) => ({
      prompt,
      score: prompt.copyCount,
      reason: 'Trending',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
