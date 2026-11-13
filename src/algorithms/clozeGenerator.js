/**
 * ReadEase Smart Flashcard Generator
 *
 * Generates revision cards from real reading material.
 *
 * Card types:
 * 1. Cloze: Fill in the missing term.
 * 2. Definition: Identify a concept from its definition.
 * 3. Recall: Recall an important concept from its source sentence.
 *
 * No external AI or API required.
 */

const DEFAULT_OPTIONS = {
  maxCards: 30,
  minimumQuality: 0.48,
  includeCloze: true,
  includeDefinitions: true,
  includeRecall: true
};

const DEFINITION_PATTERNS = [
  /\bis defined as\b/i,
  /\bis known as\b/i,
  /\brefers to\b/i,
  /\bis the process of\b/i,
  /\bis a type of\b/i,
  /\bis called\b/i,
  /\bmeans\b/i
];

const WEAK_TERMS = new Set([
  "thing",
  "things",
  "stuff",
  "something",
  "anything",
  "everything",
  "someone",
  "people",
  "person",
  "example",
  "examples"
]);

function normalize(text) {
  return String(text ?? "")
    .toLocaleLowerCase()
    .replace(/[’]/g, "'");
}

function tokenize(text) {
  return (
    String(text ?? "").match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(text) {
  return tokenize(text).length;
}

function containsWholeTerm(sentence, term) {
  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
    "iu"
  );

  return expression.test(sentence);
}

function findTermMatch(sentence, term) {
  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
    "iu"
  );

  return expression.exec(sentence);
}

function hasDefinitionPattern(sentence) {
  return DEFINITION_PATTERNS.some(pattern =>
    pattern.test(sentence)
  );
}

/**
 * Calculate how suitable a generated card is.
 */
function calculateCardQuality({
  sentenceScore = 0,
  answer,
  question,
  sentence
}) {
  const answerLength = countWords(answer);
  const sentenceLength = countWords(sentence);

  const answerClarity =
    answerLength >= 1 && answerLength <= 4 ? 1 : 0.5;

  const questionSuitability =
    question.length >= 12 && question.length <= 180 ? 1 : 0.6;

  const sourceSuitability =
    sentenceLength >= 7 && sentenceLength <= 35 ? 1 : 0.5;

  const quality =
    0.40 * sentenceScore +
    0.25 * answerClarity +
    0.20 * questionSuitability +
    0.15 * sourceSuitability;

  return Number(quality.toFixed(4));
}

function makeId(type, sentenceId, answer) {
  const value = `${type}-${sentenceId}-${normalize(answer)}`;

  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `card-${(hash >>> 0).toString(36)}`;
}

/**
 * Generate a fill-in-the-blank card.
 */
function generateClozeCard(sentence, term, options) {
  const match = findTermMatch(sentence.text, term.normalized);

  if (!match) return null;

  const answer = match[0];

  if (WEAK_TERMS.has(normalize(answer))) return null;

  const question =
    sentence.text.slice(0, match.index) +
    "________" +
    sentence.text.slice(match.index + answer.length);

  const quality = calculateCardQuality({
    sentenceScore: sentence.score ?? 0.5,
    answer,
    question,
    sentence: sentence.text
  });

  if (quality < options.minimumQuality) return null;

  return {
    id: makeId("cloze", sentence.id, answer),
    type: "cloze",
    question,
    answer,
    source: sentence.text,
    sourceId: sentence.id,
    paragraphIndex: sentence.paragraphIndex ?? null,
    quality,
    explanation: "Complete the missing term using what you remember."
  };
}

/**
 * Generate a definition recall card.
 *
 * Only generated when the source sentence contains a
 * recognizable definition pattern.
 */
function generateDefinitionCard(sentence, terms, options) {
  if (!hasDefinitionPattern(sentence.text)) return null;

  const term = terms.find(candidate =>
    !candidate.isPhrase &&
    candidate.term.length >= 4 &&
    containsWholeTerm(sentence.text, candidate.normalized)
  );

  if (!term) return null;

  const answer = term.term;

  const question =
    `Which concept is being described?\n\n${sentence.text}`;

  const quality = calculateCardQuality({
    sentenceScore: sentence.score ?? 0.5,
    answer,
    question,
    sentence: sentence.text
  });

  if (quality < options.minimumQuality) return null;

  return {
    id: makeId("definition", sentence.id, answer),
    type: "definition",
    question,
    answer,
    source: sentence.text,
    sourceId: sentence.id,
    paragraphIndex: sentence.paragraphIndex ?? null,
    quality,
    explanation: "Identify the concept described in the source material."
  };
}

/**
 * Generate a concept recall card.
 *
 * This asks students to recall an important term from
 * its original context without inventing a new fact.
 */
function generateRecallCard(sentence, terms, options) {
  const term = terms.find(candidate =>
    candidate.importance >= 0.45 &&
    candidate.term.length >= 4 &&
    containsWholeTerm(sentence.text, candidate.normalized)
  );

  if (!term) return null;

  const question =
    `What important concept appears in this statement?\n\n${sentence.text}`;

  const quality = calculateCardQuality({
    sentenceScore: sentence.score ?? 0.5,
    answer: term.term,
    question,
    sentence: sentence.text
  });

  if (quality < options.minimumQuality) return null;

  return {
    id: makeId("recall", sentence.id, term.term),
    type: "recall",
    question,
    answer: term.term,
    source: sentence.text,
    sourceId: sentence.id,
    paragraphIndex: sentence.paragraphIndex ?? null,
    quality,
    explanation: "Recall the important concept from the reading."
  };
}

/**
 * Generate revision cards.
 *
 * @param {Array} sentences Scored sentence records.
 * @param {Array} terms Extracted terms.
 * @param {Object} userOptions Configuration.
 * @returns {Array} Generated flashcards.
 */
export function generateFlashcards(
  sentences,
  terms,
  userOptions = {}
) {
  if (!Array.isArray(sentences) || !Array.isArray(terms)) {
    throw new TypeError(
      "generateFlashcards expects arrays of sentences and terms."
    );
  }

  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions
  };

  if (
    !Number.isInteger(options.maxCards) ||
    options.maxCards < 1
  ) {
    throw new RangeError("maxCards must be a positive integer.");
  }

  if (
    typeof options.minimumQuality !== "number" ||
    options.minimumQuality < 0 ||
    options.minimumQuality > 1
  ) {
    throw new RangeError(
      "minimumQuality must be between 0 and 1."
    );
  }

  const cards = [];
  const seen = new Set();

  function addCard(card) {
    if (!card || seen.has(card.id)) return;

    seen.add(card.id);
    cards.push(card);
  }

  // Higher-ranked sentences are considered first.
  const rankedSentences = [...sentences].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );

  for (const sentence of rankedSentences) {
    if (!sentence?.text) continue;

    if (options.includeDefinitions) {
      addCard(
        generateDefinitionCard(sentence, terms, options)
      );
    }

    if (options.includeCloze) {
      const matchingTerms = terms
        .filter(term =>
          term?.normalized &&
          containsWholeTerm(sentence.text, term.normalized)
        )
        .sort((a, b) => {
          // Prefer meaningful multi-word concepts.
          if (a.isPhrase !== b.isPhrase) {
            return Number(b.isPhrase) - Number(a.isPhrase);
          }

          return (b.importance ?? 0) - (a.importance ?? 0);
        });

      // Limit cards generated from one sentence.
      matchingTerms.slice(0, 2).forEach(term => {
        addCard(
          generateClozeCard(sentence, term, options)
        );
      });
    }

    if (options.includeRecall) {
      addCard(
        generateRecallCard(sentence, terms, options)
      );
    }
  }

  return cards
    .sort((a, b) => b.quality - a.quality)
    .slice(0, options.maxCards)
    .map((card, index) => ({
      ...card,
      number: index + 1
    }));
}