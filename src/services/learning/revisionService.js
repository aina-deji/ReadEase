/**
 * ReadEase Revision Service
 *
 * Manages flashcards, review sessions,
 * persistence and learning statistics.
 */

import {
  createCardSchedule,
  reviewCard,
  isCardDue,
  getRetentionRate
} from "../../algorithms/spacedRepetition.js";

const STORAGE_KEY = "readease:revision:v1";

function readStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Could not read revision data:", error);
    return {};
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    return true;
  } catch (error) {
    console.error("Could not save revision data:", error);
    return false;
  }
}

function createId() {
  if (typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `card-${Date.now()}-${Math.random()
    .toString(36).slice(2)}`;
}

function normalizeCard(card) {
  if (!card || !card.question || !card.answer) {
    throw new TypeError(
      "Every revision card needs a question and answer."
    );
  }

  return {
    ...card,
    id: card.id || createId()
  };
}

function getDatabase() {
  const database = readStorage();

  return {
    cards: Array.isArray(database.cards)
      ? database.cards
      : [],
    sessions: Array.isArray(database.sessions)
      ? database.sessions
      : []
  };
}

function saveDatabase(database) {
  return writeStorage(database);
}

/**
 * Add generated cards to the revision collection.
 */
export function addFlashcards(cards) {
  if (!Array.isArray(cards)) {
    throw new TypeError("Expected an array of flashcards.");
  }

  const database = getDatabase();

  const existingIds = new Set(
    database.cards.map(card => card.id)
  );

  const added = [];

  cards.forEach(rawCard => {
    const card = normalizeCard(rawCard);

    if (existingIds.has(card.id)) return;

    const newCard = {
      ...card,
      schedule: createCardSchedule()
    };

    database.cards.push(newCard);
    existingIds.add(card.id);

    added.push(newCard);
  });

  if (!saveDatabase(database)) {
    throw new Error(
      "Unable to save flashcards. Check browser storage."
    );
  }

  return added;
}

/**
 * Retrieve all saved flashcards.
 */
export function getAllFlashcards() {
  return getDatabase().cards;
}

/**
 * Retrieve cards that are due for review.
 */
export function getDueFlashcards(now = new Date()) {
  return getDatabase().cards
    .filter(card => isCardDue(card.schedule, now))
    .sort((a, b) => {
      const dateA = new Date(a.schedule?.dueDate || 0);
      const dateB = new Date(b.schedule?.dueDate || 0);

      return dateA - dateB;
    });
}

/**
 * Record a student's answer rating.
 */
export function recordReview(cardId, rating, now = new Date()) {
  const database = getDatabase();

  const index = database.cards.findIndex(
    card => card.id === cardId
  );

  if (index === -1) {
    throw new Error("Flashcard not found.");
  }

  const card = database.cards[index];

  card.schedule = reviewCard(
    card.schedule,
    rating,
    now
  );

  card.updatedAt = new Date(now).toISOString();

  database.cards[index] = card;

  if (!saveDatabase(database)) {
    throw new Error("Unable to save review.");
  }

  return card;
}

/**
 * Create a revision session.
 */
export function createRevisionSession(now = new Date()) {
  const database = getDatabase();

  const dueCards = database.cards
    .filter(card => isCardDue(card.schedule, now));

  const session = {
    id: createId(),
    startedAt: new Date(now).toISOString(),
    completedAt: null,
    cardIds: dueCards.map(card => card.id),
    reviewedCardIds: []
  };

  database.sessions.push(session);

  if (!saveDatabase(database)) {
    throw new Error("Unable to save revision session.");
  }

  return {
    ...session,
    cards: dueCards
  };
}

/**
 * Record a card as reviewed in a session.
 */
export function markSessionCardReviewed(sessionId, cardId) {
  const database = getDatabase();

  const session = database.sessions.find(
    item => item.id === sessionId
  );

  if (!session) {
    throw new Error("Revision session not found.");
  }

  if (!session.cardIds.includes(cardId)) {
    throw new Error("Card does not belong to this session.");
  }

  if (!session.reviewedCardIds.includes(cardId)) {
    session.reviewedCardIds.push(cardId);
  }

  if (
    session.reviewedCardIds.length ===
    session.cardIds.length
  ) {
    session.completedAt = new Date().toISOString();
  }

  if (!saveDatabase(database)) {
  throw new Error(
    "Unable to save revision session progress."
  );
}

return session;
}

/**
 * Return revision statistics.
 */
export function getRevisionStatistics() {
  const database = getDatabase();

  const cards = database.cards;

  const totalCards = cards.length;

  const dueCards = cards.filter(card =>
    isCardDue(card.schedule)
  ).length;

  const reviewedCards = cards.filter(
    card => (card.schedule?.totalReviews || 0) > 0
  );

  const totalReviews = cards.reduce(
    (sum, card) =>
      sum + (card.schedule?.totalReviews || 0),
    0
  );

  const correctReviews = cards.reduce(
    (sum, card) =>
      sum + (card.schedule?.correctReviews || 0),
    0
  );

  const retentionRate = totalReviews
    ? Math.round((correctReviews / totalReviews) * 100)
    : null;

  const masteredCards = cards.filter(card =>
    (card.schedule?.repetitions || 0) >= 3
  ).length;

  const difficultCards = cards.filter(card =>
    (card.schedule?.lapses || 0) >= 2
  ).length;

  return {
    totalCards,
    dueCards,
    reviewedCards: reviewedCards.length,
    totalReviews,
    retentionRate,
    masteredCards,
    difficultCards
  };
}

/**
 * Remove a saved flashcard.
 */
export function deleteFlashcard(cardId) {
  const database = getDatabase();

  const previousLength = database.cards.length;

  database.cards = database.cards.filter(
    card => card.id !== cardId
  );

  if (database.cards.length === previousLength) {
    return false;
  }

  database.sessions.forEach(session => {
    session.cardIds = session.cardIds.filter(
      id => id !== cardId
    );

    session.reviewedCardIds =
      session.reviewedCardIds.filter(
        id => id !== cardId
      );
  });

  saveDatabase(database);

  return true;
}