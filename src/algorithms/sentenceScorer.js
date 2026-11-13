/**
 * ReadEase Sentence Scorer
 *
 * Ranks sentences by their potential educational usefulness.
 */

const DEFINITION_PATTERNS = [
  /\bis defined as\b/i,
  /\bis known as\b/i,
  /\brefers to\b/i,
  /\bmeans that\b/i,
  /\bis the process of\b/i,
  /\bis a type of\b/i,
  /\bis called\b/i,
  /\bcan be described as\b/i,
  /\bconsists of\b/i
];

const CONCEPT_PATTERNS = [
  /\bbecause\b/i,
  /\btherefore\b/i,
  /\bcauses\b/i,
  /\bresults in\b/i,
  /\bleads to\b/i,
  /\bproduces\b/i,
  /\bconverts\b/i,
  /\bdepends on\b/i,
  /\bconsists of\b/i,
  /\bfunctions as\b/i,
  /\bresponsible for\b/i,
  /\bprocess\b/i,
  /\bfunction\b/i,
  /\bstructure\b/i,
  /\bcharacteristic\b/i
];

function normalize(text) {
  return String(text ?? "").toLocaleLowerCase();
}

function containsTerm(sentence, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu"
  );
  
  return expression.test(sentence);
}

function calculateKeywordScore(sentence, terms) {
  if (!terms.length) return 0;
  
  const matches = terms.filter(term =>
    containsTerm(sentence, term.normalized)
  );
  
  if (!matches.length) return 0;
  
  const totalImportance = matches.reduce(
    (sum, term) => sum + term.importance,
    0
  );
  
  const possibleImportance = terms
    .slice(0, 5)
    .reduce((sum, term) => sum + term.importance, 0);
  
  if (!possibleImportance) return 0;
  
  return Math.min(
    1,
    totalImportance / possibleImportance
  );
}

function calculateDefinitionScore(sentence) {
  const matches = DEFINITION_PATTERNS.filter(pattern =>
    pattern.test(sentence)
  ).length;
  
  return Math.min(1, matches / 2);
}

function calculateRelevanceScore(sentence, terms) {
  if (!terms.length) return 0;
  
  const matches = terms.filter(term =>
    containsTerm(sentence, term.normalized)
  );
  
  const uniqueConcepts = new Set(
    matches.map(term => term.normalized)
  );
  
  return Math.min(1, uniqueConcepts.size / 3);
}

function calculateConceptScore(sentence) {
  const matches = CONCEPT_PATTERNS.filter(pattern =>
    pattern.test(sentence)
  ).length;
  
  return Math.min(1, matches / 2);
}

function calculateLengthScore(sentence, wordCount) {
  // Very short sentences often lack sufficient context.
  if (wordCount < 6) return 0.2;
  
  // Ideal range for a concise revision card.
  if (wordCount >= 10 && wordCount <= 28) return 1;
  
  if (wordCount >= 6 && wordCount < 10) return 0.7;
  
  if (wordCount > 28 && wordCount <= 35) return 0.75;
  
  if (wordCount > 35 && wordCount <= 45) return 0.5;
  
  return 0.25;
}

/**
 * Score and rank reading sentences.
 *
 * @param {Array} sentences
 * @param {Array} terms
 * @returns {Array}
 */
export function scoreSentences(sentences, terms = []) {
  if (!Array.isArray(sentences)) return [];
  
  const scored = sentences.map(sentence => {
    const text = typeof sentence === "string" ?
      sentence :
      sentence.text;
    
    const normalized = normalize(text);
    
    const wordCount = (
      text.match(/[\p{L}\p{N}]+/gu) || []
    ).length;
    
    const components = {
      keywords: calculateKeywordScore(normalized, terms),
      
      definitions: calculateDefinitionScore(normalized),
      
      relevance: calculateRelevanceScore(normalized, terms),
      
      concepts: calculateConceptScore(normalized),
      
      length: calculateLengthScore(normalized, wordCount)
    };
    
    const score =
      0.30 * components.keywords +
      0.25 * components.definitions +
      0.20 * components.relevance +
      0.15 * components.concepts +
      0.10 * components.length;
    
    return {
      ...(typeof sentence === "object" ? sentence : {}),
      text,
      score: Number(score.toFixed(4)),
      components
    };
  });
  
  return scored
    .sort((a, b) => b.score - a.score)
    .map((sentence, index) => ({
      ...sentence,
      rank: index + 1
    }));
}