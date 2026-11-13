/**
 * ReadEase Term Extractor
 *
 * Identifies potentially important words and phrases.
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not",
  "you", "your", "was", "were", "has", "have",
  "had", "this", "that", "these", "those",
  "with", "from", "into", "onto", "about",
  "their", "there", "they", "them", "then",
  "than", "when", "where", "which", "while",
  "what", "who", "whom", "whose", "will",
  "would", "could", "should", "can", "may",
  "might", "must", "shall", "been", "being",
  "its", "our", "ours", "his", "her", "hers",
  "she", "him", "himself", "herself", "itself",
  "all", "any", "some", "many", "much", "more",
  "most", "other", "another", "each", "every",
  "such", "only", "also", "just", "very",
  "because", "although", "however", "therefore",
  "thus", "hence", "before", "after", "during",
  "between", "under", "over", "through",
  "within", "without", "above", "below",
  "again", "once", "here", "there", "how",
  "why", "both", "either", "neither",
  "does", "did", "doing", "done",
  "is", "am", "be", "to", "of", "in",
  "on", "at", "by", "as", "an", "a",
  "or", "if", "so", "up", "out", "off"
]);

const MIN_WORD_LENGTH = 3;
const MAX_PHRASE_LENGTH = 2;

function tokenize(text) {
  return (
    String(text ?? "").match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []
  );
}

function normalizeWord(word) {
  return word.toLocaleLowerCase().replace(/[’]/g, "'");
}

function isUsefulWord(word) {
  const normalized = normalizeWord(word);
  
  return (
    normalized.length >= MIN_WORD_LENGTH &&
    !STOP_WORDS.has(normalized) &&
    !/^\d+$/.test(normalized)
  );
}

function calculateLengthScore(word) {
  if (word.length >= 5 && word.length <= 13) return 1;
  if (word.length === 4 || word.length === 14) return 0.8;
  if (word.length === 3 || word.length === 15) return 0.6;
  
  return 0.3;
}

function calculateCapitalizationScore(word) {
  // Capitalization is only a weak signal.
  // It can identify named concepts but should not dominate ranking.
  
  if (/^[A-Z][a-z]/.test(word)) return 1;
  
  if (/^[A-Z]{2,}$/.test(word)) return 0.9;
  
  return 0.4;
}

function countOccurrences(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "giu"
  );
  
  return Array.from(text.matchAll(expression)).length;
}

/**
 * Extract important terms from reading material.
 *
 * @param {string|Array} input
 * @param {object} options
 * @returns {Array}
 */
export function extractTerms(input, options = {}) {
  const {
    maxTerms = 40,
      includePhrases = true
  } = options;
  
  const text = Array.isArray(input) ?
    input.map(item => typeof item === "string" ? item : item.text)
    .filter(Boolean)
    .join(" ") :
    String(input ?? "");
  
  if (!text.trim()) return [];
  
  const tokens = tokenize(text);
  const normalizedText = text.toLocaleLowerCase();
  
  const candidates = new Map();
  
  // Extract individual words.
  tokens.forEach(word => {
    if (!isUsefulWord(word)) return;
    
    const normalized = normalizeWord(word);
    
    if (!candidates.has(normalized)) {
      candidates.set(normalized, {
        term: word,
        normalized,
        frequency: 0,
        isPhrase: false,
        capitalization: 0
      });
    }
    
    const candidate = candidates.get(normalized);
    
    candidate.frequency += 1;
    
    if (/^[A-Z]/.test(word)) {
      candidate.capitalization += 1;
    }
  });
  
  // Extract two-word phrases.
  if (includePhrases) {
    for (let i = 0; i < tokens.length - 1; i++) {
      const first = tokens[i];
      const second = tokens[i + 1];
      
      if (!isUsefulWord(first) || !isUsefulWord(second)) {
        continue;
      }
      
      const normalized = [
        normalizeWord(first),
        normalizeWord(second)
      ].join(" ");
      
      if (!candidates.has(normalized)) {
        candidates.set(normalized, {
          term: `${first} ${second}`,
          normalized,
          frequency: 0,
          isPhrase: true,
          capitalization: 0
        });
      }
      
      candidates.get(normalized).frequency += 1;
    }
  }
  
  const maxFrequency = Math.max(
    1,
    ...Array.from(candidates.values(), item => item.frequency)
  );
  
  const results = Array.from(candidates.values()).map(candidate => {
    const frequencyScore =
      candidate.frequency / maxFrequency;
    
    const lengthScore = calculateLengthScore(
      candidate.term.replace(/\s/g, "")
    );
    
    const capitalizationScore =
      candidate.capitalization > 0 ? 1 : 0.4;
    
    const phraseScore = candidate.isPhrase ? 1 : 0.4;
    
    const importance =
      0.45 * frequencyScore +
      0.25 * lengthScore +
      0.20 * capitalizationScore +
      0.10 * phraseScore;
    
    return {
      term: candidate.term,
      normalized: candidate.normalized,
      frequency: candidate.frequency,
      isPhrase: candidate.isPhrase,
      importance: Number(importance.toFixed(4)),
      occurrences: countOccurrences(
        normalizedText,
        candidate.normalized
      )
    };
  });
  
  return results
    .sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      
      return b.frequency - a.frequency;
    })
    .slice(0, maxTerms);
}