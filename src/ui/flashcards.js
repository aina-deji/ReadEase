import {
  getAllFlashcards,
  getFlashcardGroups,
  getFlashcardGroup,
  createRevisionSession,
  createPracticeSession,
  recordReview,
  markSessionCardReviewed,
  getRevisionStatistics,
  deleteFlashcard
} from "../services/learning/revisionService.js";

const RATINGS = [
  {
    value: "again",
    label: "Again",
    description: "I couldn't remember",
    className: "rating-again"
  },
  {
    value: "hard",
    label: "Hard",
    description: "I struggled",
    className: "rating-hard"
  },
  {
    value: "good",
    label: "Good",
    description: "I remembered",
    className: "rating-good"
  },
  {
    value: "easy",
    label: "Easy",
    description: "I remembered easily",
    className: "rating-easy"
  }
];

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createButton(text, className, onClick) {
  const button = createElement("button", className, text);

  button.type = "button";
  button.addEventListener("click", onClick);

  return button;
}

function formatDate(dateValue) {
  if (!dateValue) return "Not scheduled";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatRetention(value) {
  return value === null || value === undefined
    ? "—"
    : `${value}%`;
}

export function mountFlashcards(container) {
  if (!container) {
    throw new Error(
      "Flashcards container was not provided."
    );
  }

  let session = null;
  let sessionCards = [];
  let currentIndex = 0;
  let answerRevealed = false;
  let isReviewing = false;
  let isPracticeSession = false;
  let currentGroupId = null;

  container.replaceChildren();
  container.classList.add("revision-dashboard");

  const dashboard = createElement(
    "div",
    "revision-dashboard__inner"
  );

  const header = createElement(
    "header",
    "revision-header"
  );

  const headingGroup = createElement(
    "div",
    "revision-header__text"
  );

  const eyebrow = createElement(
    "p",
    "revision-eyebrow",
    "YOUR LEARNING SPACE"
  );

  const heading = createElement(
    "h1",
    "revision-heading",
    "Revision dashboard"
  );

  const subtitle = createElement(
    "p",
    "revision-subtitle",
    "Build your understanding one review at a time."
  );

  headingGroup.append(
    eyebrow,
    heading,
    subtitle
  );

  const refreshButton = createButton(
    "Refresh progress",
    "revision-refresh-button",
    renderDashboard
  );

  header.append(
    headingGroup,
    refreshButton
  );

  const statsSection = createElement(
    "section",
    "revision-stats"
  );

  statsSection.setAttribute(
    "aria-label",
    "Your revision statistics"
  );

  const mainSection = createElement(
    "section",
    "revision-main"
  );

  mainSection.setAttribute(
    "aria-label",
    "Flashcard revision"
  );

  const librarySection = createElement(
    "section",
    "revision-library"
  );

  librarySection.setAttribute(
    "aria-label",
    "Your learning materials"
  );

  const liveRegion = createElement(
    "p",
    "revision-live-region"
  );

  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");

  dashboard.append(
    header,
    statsSection,
    mainSection,
    librarySection,
    liveRegion
  );

  container.append(dashboard);

  /* ---------------------------------------------
     GENERAL HELPERS
  --------------------------------------------- */

  function announce(message) {
    liveRegion.textContent = message;
  }

  function createStatCard(label, value, description) {
    const card = createElement(
      "article",
      "revision-stat-card"
    );

    const labelElement = createElement(
      "p",
      "revision-stat-card__label",
      label
    );

    const valueElement = createElement(
      "p",
      "revision-stat-card__value",
      String(value)
    );

    const descriptionElement = createElement(
      "p",
      "revision-stat-card__description",
      description
    );

    card.append(
      labelElement,
      valueElement,
      descriptionElement
    );

    return card;
  }

  function renderStatistics() {
    const stats = getRevisionStatistics();

    statsSection.replaceChildren(
      createStatCard(
        "Total flashcards",
        stats.totalCards,
        "Concepts saved for revision"
      ),

      createStatCard(
        "Due for review",
        stats.dueCards,
        "Ready for another look"
      ),

      createStatCard(
        "Retention",
        formatRetention(stats.retentionRate),
        "Based on your review history"
      ),

      createStatCard(
        "Mastered",
        stats.masteredCards,
        "Cards reviewed successfully"
      )
    );
  }

  /* ---------------------------------------------
     EMPTY STATES
  --------------------------------------------- */

  function createEmptyState(titleText, descriptionText) {
    const emptyState = createElement(
      "div",
      "revision-empty-state"
    );

    const icon = createElement(
      "div",
      "revision-empty-state__icon",
      "✦"
    );

    icon.setAttribute("aria-hidden", "true");

    const title = createElement(
      "h2",
      "revision-empty-state__title",
      titleText
    );

    const description = createElement(
      "p",
      "revision-empty-state__description",
      descriptionText
    );

    emptyState.append(
      icon,
      title,
      description
    );

    return emptyState;
  }

  function renderEmptyDashboard() {
    mainSection.replaceChildren();

    mainSection.append(
      createEmptyState(
        "Your revision space is ready",
        "You haven't created any flashcards yet. Open a reading document and generate flashcards to start building your revision collection."
      )
    );

    librarySection.replaceChildren();
  }

  /* ---------------------------------------------
     DASHBOARD
  --------------------------------------------- */

  function renderDashboard() {
    if (isReviewing) return;

    session = null;
    sessionCards = [];
    currentIndex = 0;
    answerRevealed = false;
    currentGroupId = null;
    isPracticeSession = false;

    renderStatistics();

    const cards = getAllFlashcards();

    mainSection.replaceChildren();
    librarySection.replaceChildren();

    if (!cards.length) {
      renderEmptyDashboard();
      return;
    }

    const stats = getRevisionStatistics();

    const intro = createElement(
      "div",
      "revision-intro"
    );

    const title = createElement(
      "h2",
      "revision-section-heading",
      "Ready to revise?"
    );

    const description = createElement(
      "p",
      "revision-section-description",
      `${stats.dueCards} flashcard${stats.dueCards === 1 ? "" : "s"} waiting for review.`
    );

    const startButton = createButton(
      stats.dueCards > 0
        ? "Review all due cards"
        : "No cards due yet",
      "revision-start-button",
      () => startRevision({})
    );

    startButton.disabled = stats.dueCards === 0;

    intro.append(
      title,
      description,
      startButton
    );

    mainSection.append(intro);

    renderGroups();
  }

  /* ---------------------------------------------
     DOCUMENT GROUPS
  --------------------------------------------- */

  function renderGroups() {
    librarySection.replaceChildren();

    const groups = getFlashcardGroups();

    const heading = createElement(
      "h2",
      "revision-section-heading",
      `Your learning materials (${groups.length})`
    );

    const description = createElement(
      "p",
      "revision-section-description",
      "Your flashcards are organised by the material they came from."
    );

    librarySection.append(
      heading,
      description
    );

    if (!groups.length) {
      librarySection.append(
        createEmptyState(
          "No learning materials yet",
          "Generate flashcards from a reading document to create your first collection."
        )
      );

      return;
    }

    const groupList = createElement(
      "div",
      "revision-group-grid"
    );

    groups.forEach(group => {
      const groupCard = createElement(
        "article",
        "revision-group-card"
      );

      const isLegacy = group.id === "legacy";

      const title = createElement(
        "h3",
        "revision-group-card__title",
        isLegacy
          ? "Previously saved cards"
          : group.title
      );

      const type = createElement(
        "p",
        "revision-group-card__type",
        isLegacy
          ? "OLDER COLLECTION"
          : "LEARNING MATERIAL"
      );

      const counts = createElement(
        "div",
        "revision-group-card__stats"
      );

      const total = createElement(
        "span",
        "revision-group-card__count",
        `${group.totalCards} cards`
      );

      const due = createElement(
        "span",
        "revision-group-card__due",
        `${group.dueCards} due`
      );

      const mastered = createElement(
        "span",
        "revision-group-card__mastered",
        `${group.masteredCards} mastered`
      );

      counts.append(
        total,
        due,
        mastered
      );

      const actions = createElement(
        "div",
        "revision-group-card__actions"
      );

      const openButton = createButton(
        "Open collection",
        "revision-group-open-button",
        () => openGroup(group.id)
      );

      const practiceButton = createButton(
        "Practise again",
        "revision-group-review-button",
        () => startPractice(group.cards, group.id)
      );

      actions.append(
        openButton,
        practiceButton
      );

      if (!isLegacy && group.dueCards > 0) {
        const reviewButton = createButton(
          "Review due cards",
          "revision-group-review-button",
          () => {
            const filters = group.documentId
              ? { documentId: group.documentId }
              : { topic: group.topic };

            startRevision(
              filters,
              group.id
            );
          }
        );

        actions.append(reviewButton);
      }

      groupCard.append(
        type,
        title,
        counts,
        actions
      );

      groupList.append(groupCard);
    });

    librarySection.append(groupList);
  }

  /* ---------------------------------------------
     OPEN A COLLECTION
  --------------------------------------------- */

  function openGroup(groupId) {
    if (isReviewing) return;

    const group = getFlashcardGroup(groupId);

    if (!group) {
      announce("This collection could not be found.");
      renderDashboard();
      return;
    }

    currentGroupId = groupId;

    mainSection.replaceChildren();
    librarySection.replaceChildren();

    const backButton = createButton(
      "← Back to collections",
      "revision-back-button",
      renderDashboard
    );

    const title = createElement(
      "h2",
      "revision-section-heading",
      group.id === "legacy"
        ? "Previously saved cards"
        : group.title
    );

    const description = createElement(
      "p",
      "revision-section-description",
      `${group.totalCards} flashcards · ${group.dueCards} due · ${group.masteredCards} mastered`
    );

    const practiceButton = createButton(
      "Practise this collection",
      "revision-start-button",
      () => startPractice(group.cards, group.id)
    );

    mainSection.append(
      backButton,
      title,
      description,
      practiceButton
    );

    if (group.dueCards > 0 && group.id !== "legacy") {
      const reviewButton = createButton(
        "Review due cards",
        "revision-group-review-button",
        () => {
          const filters = group.documentId
            ? { documentId: group.documentId }
            : { topic: group.topic };

          startRevision(
            filters,
            group.id
          );
        }
      );

      mainSection.append(reviewButton);
    }

    renderLibrary(group.cards);
  }

  /* ---------------------------------------------
     FLASHCARD LIBRARY
  --------------------------------------------- */

  function renderLibrary(cards) {
    librarySection.replaceChildren();

    const heading = createElement(
      "h3",
      "revision-section-heading",
      `Flashcards (${cards.length})`
    );

    librarySection.append(heading);

    if (!cards.length) {
      librarySection.append(
        createEmptyState(
          "This collection is empty",
          "There are no flashcards in this collection."
        )
      );

      return;
    }

    const list = createElement(
      "div",
      "revision-card-list"
    );

    cards.forEach(card => {
      const item = createElement(
        "article",
        "revision-library-card"
      );

      const content = createElement(
        "div",
        "revision-library-card__content"
      );

      const question = createElement(
        "p",
        "revision-library-card__question",
        card.question || "Untitled flashcard"
      );

      const type = createElement(
        "span",
        "revision-library-card__type",
        card.type || "Flashcard"
      );

      const dueDate = createElement(
        "span",
        "revision-library-card__date",
        `Next review: ${formatDate(card.schedule?.dueDate)}`
      );

      content.append(
        question,
        type,
        dueDate
      );

      const removeButton = createButton(
        "Delete",
        "revision-delete-button",
        () => {
          const confirmed = window.confirm(
            "Delete this flashcard? This action cannot be undone."
          );

          if (!confirmed) return;

          const deleted = deleteFlashcard(card.id);

          if (!deleted) {
            announce("The flashcard could not be deleted.");
            return;
          }

          announce("Flashcard deleted.");

          if (currentGroupId) {
            openGroup(currentGroupId);
          } else {
            renderDashboard();
          }

          renderStatistics();
        }
      );

      removeButton.setAttribute(
        "aria-label",
        `Delete flashcard: ${card.question || "Untitled flashcard"}`
      );

      item.append(
        content,
        removeButton
      );

      list.append(item);
    });

    librarySection.append(list);
  }

  /* ---------------------------------------------
     NORMAL REVISION SESSION
  --------------------------------------------- */

  function startRevision(filters = {}, returnGroupId = null) {
    try {
      const result = createRevisionSession(
        new Date(),
        filters
      );

      if (!result || !result.cards || !result.cards.length) {
        announce("There are no flashcards due for review.");

        if (returnGroupId) {
          openGroup(returnGroupId);
        } else {
          renderDashboard();
        }

        return;
      }

      session = result;
      sessionCards = result.cards;
      currentIndex = 0;
      answerRevealed = false;
      isReviewing = true;
      isPracticeSession = false;

      currentGroupId = returnGroupId;

      renderCurrentCard();

      announce(
        `Revision started. ${sessionCards.length} cards to review.`
      );

    } catch (error) {
      console.error(
        "Could not start revision session:",
        error
      );

      announce(
        "Something went wrong while starting your revision session."
      );
    }
  }

  /* ---------------------------------------------
     REPEAT PRACTICE SESSION
  --------------------------------------------- */

  function startPractice(cards, returnGroupId = null) {
    try {
      if (!Array.isArray(cards) || !cards.length) {
        announce("There are no cards in this collection to practise.");
        return;
      }

      const result = createPracticeSession(
        cards.map(card => card.id)
      );

      if (!result || !result.cards || !result.cards.length) {
        announce("We couldn't start this practice session.");
        return;
      }

      session = result;
      sessionCards = result.cards;
      currentIndex = 0;
      answerRevealed = false;
      isReviewing = true;
      isPracticeSession = true;

      currentGroupId = returnGroupId;

      renderCurrentCard();

      announce(
        `Practice started. ${sessionCards.length} cards to practise.`
      );

    } catch (error) {
      console.error(
        "Could not start practice session:",
        error
      );

      announce(
        "Something went wrong while starting practice."
      );
    }
  }

  /* ---------------------------------------------
     CURRENT FLASHCARD
  --------------------------------------------- */

  function renderCurrentCard() {
    mainSection.replaceChildren();

    if (currentIndex >= sessionCards.length) {
      renderSessionComplete();
      return;
    }

    const card = sessionCards[currentIndex];

    const progress = createElement(
      "div",
      "revision-progress"
    );

    const progressText = createElement(
      "p",
      "revision-progress__text",
      `Card ${currentIndex + 1} of ${sessionCards.length}`
    );

    const progressTrack = createElement(
      "div",
      "revision-progress__track"
    );

    const progressBar = createElement(
      "div",
      "revision-progress__bar"
    );

    const progressPercentage =
      ((currentIndex + 1) / sessionCards.length) * 100;

    progressBar.style.width =
      `${progressPercentage}%`;

    progressTrack.append(progressBar);

    progress.append(
      progressText,
      progressTrack
    );

    const cardPanel = createElement(
      "article",
      "revision-review-card"
    );

    const cardType = createElement(
      "p",
      "revision-review-card__type",
      isPracticeSession
        ? "PRACTICE"
        : card.type || "FLASHCARD"
    );

    const question = createElement(
      "h2",
      "revision-review-card__question",
      card.question || "What can you remember?"
    );

    const answerPanel = createElement(
      "div",
      "revision-answer-panel"
    );

    if (answerRevealed) {
      const answerHeading = createElement(
        "h3",
        "revision-answer-panel__heading",
        "Answer"
      );

      const answer = createElement(
        "p",
        "revision-answer-panel__text",
        card.answer || "No answer was provided."
      );

      answerPanel.append(
        answerHeading,
        answer
      );

      if (card.explanation) {
        const explanation = createElement(
          "p",
          "revision-answer-panel__explanation",
          card.explanation
        );

        answerPanel.append(explanation);
      }

      if (card.source) {
        const source = createElement(
          "details",
          "revision-source"
        );

        const sourceSummary = createElement(
          "summary",
          "",
          "View original reading material"
        );

        const sourceText = createElement(
          "p",
          "revision-source__text",
          card.source
        );

        source.append(
          sourceSummary,
          sourceText
        );

        answerPanel.append(source);
      }

    } else {
      const revealButton = createButton(
        "Reveal answer",
        "revision-reveal-button",
        () => {
          answerRevealed = true;
          renderCurrentCard();
        }
      );

      answerPanel.append(revealButton);
    }

    cardPanel.append(
      cardType,
      question,
      answerPanel
    );

    const ratingSection = createElement(
      "div",
      "revision-rating"
    );

    if (answerRevealed && !isPracticeSession) {
      const ratingHeading = createElement(
        "h3",
        "revision-rating__heading",
        "How well did you remember?"
      );

      const ratingButtons = createElement(
        "div",
        "revision-rating__buttons"
      );

      RATINGS.forEach(rating => {
        const button = createButton(
          rating.label,
          `revision-rating__button ${rating.className}`,
          () => submitRating(rating.value)
        );

        const description = createElement(
          "span",
          "revision-rating__description",
          rating.description
        );

        button.append(description);
        ratingButtons.append(button);
      });

      ratingSection.append(
        ratingHeading,
        ratingButtons
      );
    }

    if (answerRevealed && isPracticeSession) {
      const practiceMessage = createElement(
        "p",
        "revision-section-description",
        "Take a moment to compare the answer with what you remembered."
      );

      const nextButton = createButton(
        currentIndex === sessionCards.length - 1
          ? "Finish practice"
          : "Next card",
        "revision-start-button",
        continuePractice
      );

      ratingSection.append(
        practiceMessage,
        nextButton
      );
    }

    const exitButton = createButton(
      "End session",
      "revision-exit-button",
      () => {
        isReviewing = false;
        isPracticeSession = false;

        if (currentGroupId) {
          openGroup(currentGroupId);
        } else {
          renderDashboard();
        }

        announce("Session ended.");
      }
    );

    mainSection.append(
      progress,
      cardPanel,
      ratingSection,
      exitButton
    );

    librarySection.replaceChildren();
  }

  /* ---------------------------------------------
     PRACTICE SESSION PROGRESSION
  --------------------------------------------- */

  function continuePractice() {
    if (!isReviewing || !isPracticeSession || !answerRevealed) {
      return;
    }

    const card = sessionCards[currentIndex];

    try {
      // Save practice-session progress only.
      // Do not update the card's spaced-repetition schedule.
      markSessionCardReviewed(
        session.id,
        card.id
      );

      currentIndex += 1;
      answerRevealed = false;

      renderCurrentCard();

      announce(
        currentIndex >= sessionCards.length
          ? "Practice completed."
          : `Moving to card ${currentIndex + 1}.`
      );

    } catch (error) {
      console.error(
        "Could not save practice progress:",
        error
      );

      announce(
        "Your practice progress could not be saved. Please try again."
      );
    }
  }

  /* ---------------------------------------------
     NORMAL REVIEW RATINGS
  --------------------------------------------- */

  function submitRating(rating) {
    if (
      !answerRevealed ||
      !isReviewing ||
      isPracticeSession
    ) {
      return;
    }

    const card = sessionCards[currentIndex];

    try {
      recordReview(card.id, rating);

      markSessionCardReviewed(
        session.id,
        card.id
      );

      announce(`Card rated ${rating}.`);

      currentIndex += 1;
      answerRevealed = false;

      renderCurrentCard();
      renderStatistics();

    } catch (error) {
      console.error(
        "Could not save flashcard review:",
        error
      );

      announce(
        "Your review could not be saved. Please try again."
      );
    }
  }

  /* ---------------------------------------------
     SESSION COMPLETION
  --------------------------------------------- */

  function renderSessionComplete() {
    mainSection.replaceChildren();

    const completion = createElement(
      "div",
      "revision-complete"
    );

    const icon = createElement(
      "div",
      "revision-complete__icon",
      "✓"
    );

    icon.setAttribute("aria-hidden", "true");

    const title = createElement(
      "h2",
      "revision-complete__title",
      isPracticeSession
        ? "Practice complete!"
        : "Session complete!"
    );

    const description = createElement(
      "p",
      "revision-complete__description",
      isPracticeSession
        ? `You practised ${sessionCards.length} flashcard${sessionCards.length === 1 ? "" : "s"}. Your revision schedule and mastery progress have been preserved.`
        : `You reviewed ${sessionCards.length} flashcard${sessionCards.length === 1 ? "" : "s"}. Great work!`
    );

    const finishButton = createButton(
      "Back to dashboard",
      "revision-start-button",
      () => {
        isReviewing = false;
        isPracticeSession = false;

        renderDashboard();

        announce(
          isPracticeSession
            ? "Practice completed."
            : "Revision session completed."
        );
      }
    );

    completion.append(
      icon,
      title,
      description,
      finishButton
    );

    mainSection.append(completion);

    renderStatistics();
    librarySection.replaceChildren();
  }

  /* ---------------------------------------------
     INITIAL RENDER
  --------------------------------------------- */

  renderDashboard();

  return {
    refresh: renderDashboard,

    destroy() {
      container.replaceChildren();

      container.classList.remove(
        "revision-dashboard"
      );
    }
  };
}