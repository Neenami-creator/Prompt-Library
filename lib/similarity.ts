/**
 * Overlap detection for incoming prompts.
 *
 * Scores a candidate prompt against the existing library so an import can tell
 * the difference between something genuinely new, a near-copy of a prompt that
 * is already filed, and a better-written version of one worth replacing.
 *
 * The comparison is deliberately dependency-free and runs in the browser: a
 * TF-IDF vector per prompt, cosine similarity between them, computed over two
 * separate views of the text. Titles and descriptions say what a prompt *is*;
 * the prompt body says what it *does*. Weighing both stops a shared subject
 * ("logo", "portrait") from reading as a duplicate when the actual instructions
 * differ, which is the common case in this library.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has",
  "have", "if", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "then", "there", "these", "this", "to", "was", "were", "will", "with",
  "you", "your", "i", "me", "my", "we", "our", "they", "them", "he", "she", "his",
  "her", "do", "does", "did", "so", "can", "could", "should", "would", "not",
  "no", "yes", "any", "all", "each", "every", "make", "use", "using", "want",
]);

function tokenise(value: string) {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  // Bigrams carry phrasing ("product shot", "growth blueprint") that single
  // words lose, which is most of what distinguishes two prompts on one subject.
  const terms = [...words];
  for (let index = 0; index < words.length - 1; index += 1) {
    terms.push(`${words[index]} ${words[index + 1]}`);
  }
  return terms;
}

function termFrequencies(terms: string[]) {
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  return counts;
}

type Vector = Map<string, number>;

function buildVector(terms: string[], idf: Map<string, number>, fallbackIdf: number): Vector {
  const counts = termFrequencies(terms);
  const vector: Vector = new Map();
  let norm = 0;
  for (const [term, count] of counts) {
    // Sublinear term frequency: a word repeated twenty times in a long prompt
    // should not outweigh a rarer, more telling one.
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? fallbackIdf);
    vector.set(term, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  for (const [term, weight] of vector) vector.set(term, weight / norm);
  return vector;
}

function cosine(a: Vector, b: Vector) {
  // Walk the shorter vector; both are already unit-normalised.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let total = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) total += weight * other;
  }
  return total;
}

function inverseDocumentFrequency(documents: string[][]) {
  const documentCount = documents.length || 1;
  const seen = new Map<string, number>();
  for (const terms of documents) {
    for (const term of new Set(terms)) seen.set(term, (seen.get(term) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of seen) {
    idf.set(term, Math.log(documentCount / count) + 1);
  }
  return { idf, fallback: Math.log(documentCount) + 1 };
}

export type ComparablePrompt = {
  id: string;
  title: string;
  category: string;
  description: string;
  promptText: string;
};

export type OverlapMatch = {
  id: string;
  title: string;
  category: string;
  /** Combined 0–1 similarity. */
  score: number;
  /** How alike the titles and descriptions are. */
  identityScore: number;
  /** How alike the prompt bodies are. */
  bodyScore: number;
};

/** Identity carries less weight than the body: two prompts can share a subject and still do different work. */
const IDENTITY_WEIGHT = 0.45;
const BODY_WEIGHT = 0.55;

/**
 * Thresholds are calibrated against the real library rather than picked by
 * feel. Scoring all 463 filed prompts against each other (leave-one-out), only
 * two pairs reach 0.40 at all and the highest scores 0.48 — and that pair is
 * two genuinely different portrait prompts. Against the same library an exact
 * copy scores 1.00 and a lightly reworded copy 0.95. So 0.62 sits in open space
 * between "a reworded duplicate" and "the most alike pair this library holds",
 * while the 0.40 band surfaces same-subject prompts worth a human glance
 * without crying wolf.
 */
export const DUPLICATE_THRESHOLD = 0.62;
export const REVIEW_THRESHOLD = 0.4;

export type Matcher = (candidate: {
  title: string;
  description: string;
  promptText: string;
}) => OverlapMatch[];

/**
 * Prepares the library side of the comparison once, then returns a function
 * that scores any number of incoming prompts against it.
 */
export function buildMatcher(library: ComparablePrompt[]): Matcher {
  const identityTerms = library.map((item) =>
    tokenise(`${item.title} ${item.description}`),
  );
  const bodyTerms = library.map((item) => tokenise(item.promptText));

  const identityIdf = inverseDocumentFrequency(identityTerms);
  const bodyIdf = inverseDocumentFrequency(bodyTerms);

  const identityVectors = identityTerms.map((terms) =>
    buildVector(terms, identityIdf.idf, identityIdf.fallback),
  );
  const bodyVectors = bodyTerms.map((terms) =>
    buildVector(terms, bodyIdf.idf, bodyIdf.fallback),
  );

  return (candidate) => {
    const candidateIdentity = buildVector(
      tokenise(`${candidate.title} ${candidate.description}`),
      identityIdf.idf,
      identityIdf.fallback,
    );
    const candidateBody = buildVector(
      tokenise(candidate.promptText),
      bodyIdf.idf,
      bodyIdf.fallback,
    );

    const matches: OverlapMatch[] = [];
    for (let index = 0; index < library.length; index += 1) {
      const identityScore = cosine(candidateIdentity, identityVectors[index]);
      const bodyScore = cosine(candidateBody, bodyVectors[index]);
      const score = IDENTITY_WEIGHT * identityScore + BODY_WEIGHT * bodyScore;
      if (score >= REVIEW_THRESHOLD) {
        matches.push({
          id: library[index].id,
          title: library[index].title,
          category: library[index].category,
          score,
          identityScore,
          bodyScore,
        });
      }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, 3);
  };
}
