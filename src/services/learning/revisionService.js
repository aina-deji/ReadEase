/**
 * ReadEase Revision Service
 *
 * Manages flashcards, topic groups, review sessions,
 * persistence and learning statistics.
 *
 * Existing saved flashcards are preserved.
 */

import {
  createCardSchedule,
  reviewCard,
  isCardDue
} from "../../algorithms/spacedRepetition.js";

const STORAGE_KEY = "readease:revision:v1";

const LEGACY_GROUP_ID = "legacy";
const LEGACY_GROUP_TITLE = "Legacy cards";

/* --------------------------------------------------
   STORAGE
-------------------------------------------------- */

function readStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return {
        cards: [],
        sessions: []
      };
    }

    const parsed = JSON.parse(stored);

    return {
      cards: Array.isArray(parsed.cards)
        ? parsed.cards
        : [],

      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions
        : []
    };
  } catch (error) {
    console.error("Could not read revision data:", error);

    return {
      cards: [],
      sessions: []
    };
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

function getDatabase() {
  return readStorage();
}

function saveDatabase(database) {
  if (!writeStorage(database)) {
    throw new Error(
      "Unable to save revision data. Check browser storage."
    );
  }

  return true;
}

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `card-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function normalizeDate(value) {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid date provided.");
  }

  return date;
}

function normalizeCard(card) {
  if (
    !card ||
    typeof card.question !== "string" ||
    typeof card.answer !== "string" ||
    !card.question.trim() ||
    !card.answer.trim()
  ) {
    throw new TypeError(
      "Every revision card needs a question and answer."
    );
  }

  return {
    ...card,

    id: card.id || createId(),

    question: card.question.trim(),
    answer: card.answer.trim(),

    documentId: card.documentId || null,

    documentTitle:
      card.documentTitle || "Untitled document",

    topic: card.topic || null,

    schedule: card.schedule || createCardSchedule(),

    createdAt:
      card.createdAt || new Date().toISOString()
  };
}

function getCardGroupId(card) {
  if (card.documentId) {
    return `document:${card.documentId}`;
  }

  if (card.topic) {
    return `topic:${card.topic}`;
  }

  return LEGACY_GROUP_ID;
}

function getCardGroupTitle(card) {
  if (card.documentTitle) {
    return card.documentTitle;
  }

  if (card.topic) {
    return card.topic;
  }

  return LEGACY_GROUP_TITLE;
}

function sortByDueDate(cards) {
  return [...cards].sort((a, b) => {
    const dateA = new Date(
      a.schedule?.dueDate || 0
    ).getTime();

    const dateB = new Date(
      b.schedule?.dueDate || 0
    ).getTime();

    return dateA - dateB;
  });
}

function matchesFilters(card, filters = {}) {
  if (
    filters.documentId &&
    card.documentId !== filters.documentId
  ) {
    return false;
  }

  if (
    filters.topic &&
    card.topic !== filters.topic
  ) {
    return false;
  }

  return true;
}

function getSessionCards(session, cards) {
  const cardMap = new Map(
    cards.map(card => [card.id, card])
  );

  return session.cardIds
    .map(id => cardMap.get(id))
    .filter(Boolean);
}

/* --------------------------------------------------
   FLASHCARD CREATION
-------------------------------------------------- */

/**
 * Add generated flashcards to the collection.
 *
 * Existing card IDs are not duplicated.
 */
export function addFlashcards(cards) {
  if (!Array.isArray(cards)) {
    throw new TypeError(
      "Expected an array of flashcards."
    );
  }

  const database = getDatabase();

  const existingIds = new Set(
    database.cards.map(card => card.id)
  );

  const added = [];

  cards.forEach(rawCard => {
    const card = normalizeCard(rawCard);

    if (existingIds.has(card.id)) {
      return;
    }

    const newCard = {
      ...card,

      schedule: card.schedule ||
        createCardSchedule()
    };

    database.cards.push(newCard);

    existingIds.add(newCard.id);

    added.push(newCard);
  });

  if (added.length > 0) {
    saveDatabase(database);
  }

  return added;
}

/* --------------------------------------------------
   FLASHCARD RETRIEVAL
-------------------------------------------------- */

/**
 * Retrieve every saved flashcard.
 */
export function getAllFlashcards() {
  return getDatabase().cards;
}

/**
 * Retrieve a single flashcard.
 */
export function getFlashcardById(cardId) {
  return getDatabase().cards.find(
    card => card.id === cardId
  ) || null;
}

/**
 * Retrieve flashcards belonging to a document.
 */
export function getFlashcardsByDocument(documentId) {
  if (!documentId) {
    return [];
  }

  return getDatabase().cards.filter(
    card => card.documentId === documentId
  );
}

/**
 * Retrieve flashcards belonging to a topic.
 */
export function getFlashcardsByTopic(topic) {
  if (!topic) {
    return [];
  }

  return getDatabase().cards.filter(
    card => card.topic === topic
  );
}

/* --------------------------------------------------
   TOPIC AND DOCUMENT GROUPS
-------------------------------------------------- */

/**
 * Return flashcards grouped by document or topic.
 *
 * Cards without document IDs are preserved
 * in a Legacy cards group.
 */
export function getFlashcardGroups(now = new Date()) {
  const database = getDatabase();

  const groups = new Map();

  database.cards.forEach(card => {
    const groupId = getCardGroupId(card);

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,

        documentId: card.documentId || null,

        topic: card.topic || null,

        title: getCardGroupTitle(card),

        cards: []
      });
    }

    groups.get(groupId).cards.push(card);
  });

  return Array.from(groups.values()).map(group => {
    const dueCards = group.cards.filter(card =>
      isCardDue(card.schedule, now)
    );

    const reviewedCards = group.cards.filter(
      card => (card.schedule?.totalReviews || 0) > 0
    );

    return {
      ...group,

      totalCards: group.cards.length,

      dueCards: dueCards.length,

      reviewedCards: reviewedCards.length,

      masteredCards: group.cards.filter(
        card => (card.schedule?.repetitions || 0) >= 3
      ).length,

      difficultCards: group.cards.filter(
        card => (card.schedule?.lapses || 0) >= 2
      ).length,

      cards: [...group.cards]
    };
  });
}

/**
 * Retrieve a single document/topic group.
 */
export function getFlashcardGroup(groupId, now = new Date()) {
  return getFlashcardGroups(now).find(
    group => group.id === groupId
  ) || null;
}

/* --------------------------------------------------
   DUE FLASHCARDS
-------------------------------------------------- */

/**
 * Retrieve cards due for revision.
 *
 * Optional filters:
 * {
 *   documentId: "document-id",
 *   topic: "Biology"
 * }
 */
export function getDueFlashcards(
  now = new Date(),
  filters = {}
) {
  const database = getDatabase();

  const date = normalizeDate(now);

  const dueCards = database.cards.filter(card => {
    return (
      matchesFilters(card, filters) &&
      isCardDue(card.schedule, date)
    );
  });

  return sortByDueDate(dueCards);
}

/* --------------------------------------------------
   REVIEW RECORDING
-------------------------------------------------- */

/**
 * Record a student's answer rating.
 */
export function recordReview(
  cardId,
  rating,
  now = new Date()
) {
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
    normalizeDate(now)
  );

  card.updatedAt = normalizeDate(now).toISOString();

  database.cards[index] = card;

  saveDatabase(database);

  return card;
}

/* --------------------------------------------------
   REVISION SESSIONS
-------------------------------------------------- */

/**
 * Create a revision session.
 *
 * Existing usage remains valid:
 * createRevisionSession()
 *
 * Optional filtered usage:
 * createRevisionSession(new Date(), {
 *   documentId: "document-id"
 * })
 *
 * Or:
 * createRevisionSession(new Date(), {
 *   topic: "Biology"
 * })
 */
export function createRevisionSession(
  now = new Date(),
  filters = {}
) {
  const date = normalizeDate(now);

  const dueCards = getDueFlashcards(date, filters);

  const session = {
    id: createId(),

    startedAt: date.toISOString(),

    completedAt: dueCards.length === 0
      ? date.toISOString()
      : null,

    cardIds: dueCards.map(card => card.id),

    reviewedCardIds: [],

    documentId: filters.documentId || null,

    topic: filters.topic || null
  };

  // Do not store empty sessions.
  if (dueCards.length > 0) {
    const database = getDatabase();

    database.sessions.push(session);

    saveDatabase(database);
  }

  return {
    ...session,

    cards: dueCards
  };
}

/**
 * Create a practice session using every card in a collection.
 *
 * Unlike revision sessions, practice sessions:
 * - Include cards regardless of their due dates.
 * - Preserve existing spaced-repetition schedules.
 * - Do not record ratings or alter mastery progress.
 *
 * Usage:
 * createPracticeSession(["card-id-1", "card-id-2"])
 */
export function createPracticeSession(
  cardIds,
  now = new Date()
) {
  if (!Array.isArray(cardIds)) {
    throw new TypeError(
      "Practice sessions require an array of card IDs."
    );
  }
  
  const date = normalizeDate(now);
  const database = getDatabase();
  
  const requestedIds = [...new Set(cardIds)];
  
  const cardMap = new Map(
    database.cards.map(card => [card.id, card])
  );
  
  // Preserve the order supplied by the collection.
  const cards = requestedIds
    .map(id => cardMap.get(id))
    .filter(Boolean);
  
  if (!cards.length) {
    return null;
  }
  
  const session = {
    id: createId(),
    
    mode: "practice",
    
    startedAt: date.toISOString(),
    
    completedAt: null,
    
    cardIds: cards.map(card => card.id),
    
    reviewedCardIds: [],
    
    documentId: null,
    
    topic: null
  };
  
  database.sessions.push(session);
  
  saveDatabase(database);
  
  return {
    ...session,
    cards
  };
}

/**
 * Retrieve a saved revision session.
 */
export function getRevisionSession(sessionId) {
  const database = getDatabase();

  const session = database.sessions.find(
    item => item.id === sessionId
  );

  if (!session) {
    return null;
  }

  return {
    ...session,

    cards: getSessionCards(
      session,
      database.cards
    )
  };
}

/**
 * Retrieve unfinished revision sessions.
 */
export function getActiveRevisionSessions() {
  const database = getDatabase();

  return database.sessions
    .filter(session => !session.completedAt)
    .map(session => ({
      ...session,

      cards: getSessionCards(
        session,
        database.cards
      ),

      remainingCards: session.cardIds.length -
        session.reviewedCardIds.length
    }))
    .filter(session => session.remainingCards > 0);
}

/**
 * Record a card as reviewed in a session.
 */
export function markSessionCardReviewed(
  sessionId,
  cardId
) {
  const database = getDatabase();

  const session = database.sessions.find(
    item => item.id === sessionId
  );

  if (!session) {
    throw new Error("Revision session not found.");
  }

  if (!session.cardIds.includes(cardId)) {
    throw new Error(
      "Card does not belong to this session."
    );
  }

  if (!session.reviewedCardIds.includes(cardId)) {
    session.reviewedCardIds.push(cardId);
  }

  if (
    session.reviewedCardIds.length >=
    session.cardIds.length
  ) {
    session.completedAt = new Date().toISOString();
  }

  saveDatabase(database);

  return session;
}

/**
 * Explicitly complete a revision session.
 */
export function completeRevisionSession(sessionId) {
  const database = getDatabase();

  const session = database.sessions.find(
    item => item.id === sessionId
  );

  if (!session) {
    throw new Error("Revision session not found.");
  }

  session.completedAt = new Date().toISOString();

  saveDatabase(database);

  return session;
}

/* --------------------------------------------------
   REVISION STATISTICS
-------------------------------------------------- */

/**
 * Return overall revision statistics.
 */
export function getRevisionStatistics(now = new Date()) {
  const database = getDatabase();

  const cards = database.cards;

  const totalCards = cards.length;

  const dueCards = cards.filter(card =>
    isCardDue(card.schedule, now)
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
    ? Math.round(
        (correctReviews / totalReviews) * 100
      )
    : null;

  const masteredCards = cards.filter(
    card => (card.schedule?.repetitions || 0) >= 3
  ).length;

  const difficultCards = cards.filter(
    card => (card.schedule?.lapses || 0) >= 2
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
 * Return statistics for one document/topic group.
 */
export function getGroupStatistics(groupId, now = new Date()) {
  const group = getFlashcardGroup(groupId, now);

  if (!group) {
    return null;
  }

  const totalReviews = group.cards.reduce(
    (sum, card) =>
      sum + (card.schedule?.totalReviews || 0),
    0
  );

  const correctReviews = group.cards.reduce(
    (sum, card) =>
      sum + (card.schedule?.correctReviews || 0),
    0
  );

  return {
    totalCards: group.totalCards,

    dueCards: group.dueCards,

    reviewedCards: group.reviewedCards,

    masteredCards: group.masteredCards,

    difficultCards: group.difficultCards,

    retentionRate: totalReviews
      ? Math.round(
          (correctReviews / totalReviews) * 100
        )
      : null
  };
}

/* --------------------------------------------------
   FLASHCARD DELETION
-------------------------------------------------- */

/**
 * Remove a saved flashcard.
 *
 * Also updates any sessions containing the card.
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

    if (
      session.cardIds.length > 0 &&
      session.reviewedCardIds.length >=
      session.cardIds.length
    ) {
      session.completedAt =
        session.completedAt ||
        new Date().toISOString();
    }
  });

  saveDatabase(database);

  return true;
}

/* --------------------------------------------------
   GROUP DELETION
-------------------------------------------------- */

/**
 * Delete all cards belonging to a document/topic group.
 *
 * This is intended for a future explicit
 * "Delete topic" action in the interface.
 */
export function deleteFlashcardGroup(groupId) {
  if (!groupId) {
    return false;
  }

  const database = getDatabase();

  const group = getFlashcardGroups().find(
    item => item.id === groupId
  );

  if (!group) {
    return false;
  }

  const idsToDelete = new Set(
    group.cards.map(card => card.id)
  );

  database.cards = database.cards.filter(
    card => !idsToDelete.has(card.id)
  );

  database.sessions.forEach(session => {
    session.cardIds = session.cardIds.filter(
      id => !idsToDelete.has(id)
    );

    session.reviewedCardIds =
      session.reviewedCardIds.filter(
        id => !idsToDelete.has(id)
      );

    if (
      session.cardIds.length > 0 &&
      session.reviewedCardIds.length >=
      session.cardIds.length
    ) {
      session.completedAt =
        session.completedAt ||
        new Date().toISOString();
    }
  });

  saveDatabase(database);

  return true;
}