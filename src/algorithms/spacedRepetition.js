/**
 * ReadEase Spaced Repetition Engine
 *
 * Modified SM-2-inspired scheduling algorithm.
 *
 * Ratings:
 * again = 1
 * hard  = 3
 * good  = 4
 * easy  = 5
 */

const DEFAULTS = {
  initialEase: 2.5,
  minimumEase: 1.3,
  maximumEase: 3.0,
  maximumInterval: 365,
  learningInterval: 10,
  hardInterval: 1,
  easyInterval: 4
};

const RATINGS = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function validDate(value) {
  const date = value instanceof Date
    ? new Date(value)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid review date.");
  }

  return date;
}

function calculateEaseFactor(currentEase, grade) {
  const adjustment =
    0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);

  return clamp(
    currentEase + adjustment,
    DEFAULTS.minimumEase,
    DEFAULTS.maximumEase
  );
}

/**
 * Create initial scheduling information for a card.
 */
export function createCardSchedule(now = new Date()) {
  const currentDate = validDate(now);

  return {
    easeFactor: DEFAULTS.initialEase,
    repetitions: 0,
    interval: 0,
    dueDate: currentDate.toISOString(),
    lastReviewed: null,
    totalReviews: 0,
    correctReviews: 0,
    lapses: 0,
    history: []
  };
}

/**
 * Calculate the next review schedule.
 */
export function reviewCard(
  schedule,
  rating,
  now = new Date()
) {
  if (!RATINGS[rating]) {
    throw new RangeError(
      "Rating must be again, hard, good or easy."
    );
  }

  const currentDate = validDate(now);

  const previous = {
    ...createCardSchedule(currentDate),
    ...(schedule ?? {})
  };

  const grade = RATINGS[rating];

  let repetitions = previous.repetitions;
  let interval = previous.interval;

  let easeFactor = clamp(
    Number(previous.easeFactor) || DEFAULTS.initialEase,
    DEFAULTS.minimumEase,
    DEFAULTS.maximumEase
  );

  if (rating === "again") {
    repetitions = 0;
    interval = 0;
  } else {
    repetitions += 1;

    easeFactor = calculateEaseFactor(
      easeFactor,
      grade
    );

    if (rating === "hard") {
      interval = repetitions === 1
        ? DEFAULTS.hardInterval
        : Math.max(1, Math.round(
            Math.max(1, interval) * 1.2
          ));
    } else if (rating === "good") {
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 3;
      } else {
        interval = Math.round(
          Math.max(1, interval) * easeFactor
        );
      }
    } else if (rating === "easy") {
      if (repetitions === 1) {
        interval = DEFAULTS.easyInterval;
      } else {
        interval = Math.round(
          Math.max(1, interval) * easeFactor * 1.3
        );
      }
    }
  }

  interval = clamp(
    interval,
    0,
    DEFAULTS.maximumInterval
  );

  const dueDate = addDays(currentDate, interval);

  const history = Array.isArray(previous.history)
    ? previous.history.slice(-49)
    : [];

  history.push({
    rating,
    grade,
    reviewedAt: currentDate.toISOString(),
    interval,
    easeFactor: Number(easeFactor.toFixed(2))
  });

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
    interval,
    dueDate: dueDate.toISOString(),
    lastReviewed: currentDate.toISOString(),
    totalReviews: (previous.totalReviews || 0) + 1,
    correctReviews:
      (previous.correctReviews || 0) +
      (rating === "again" ? 0 : 1),
    lapses:
      (previous.lapses || 0) +
      (rating === "again" ? 1 : 0),
    history
  };
}

/**
 * Check whether a card is due.
 */
export function isCardDue(schedule, now = new Date()) {
  if (!schedule?.dueDate) return true;

  return (
    new Date(schedule.dueDate).getTime() <=
    validDate(now).getTime()
  );
}

/**
 * Calculate the number of days remaining.
 */
export function daysUntilDue(schedule, now = new Date()) {
  if (!schedule?.dueDate) return 0;

  const difference =
    new Date(schedule.dueDate).getTime() -
    validDate(now).getTime();

  return Math.max(
    0,
    Math.ceil(difference / 86400000)
  );
}

/**
 * Calculate card retention performance.
 */
export function getRetentionRate(schedule) {
  const total = schedule?.totalReviews || 0;

  if (!total) return null;

  return Math.round(
    (schedule.correctReviews / total) * 100
  );
}