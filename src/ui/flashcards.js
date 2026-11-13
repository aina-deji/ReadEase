import {
  getAllFlashcards,
  createRevisionSession,
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
    throw new Error("Flashcards container was not provided.");
  }

  let session = null;
  let sessionCards = [];
  let currentIndex = 0;
  let answerRevealed = false;
  let isReviewing = false;

  container.replaceChildren();
  container.classList.add("revision-dashboard");

  const dashboard = createElement("div", "revision-dashboard__inner");

  const header = createElement("header", "revision-header");
  const headingGroup = createElement("div", "revision-header__text");

  const eyebrow = createElement("p", "revision-eyebrow", "YOUR LEARNING SPACE");
  const heading = createElement("h1", "revision-heading", "Revision dashboard");
  const subtitle = createElement(
    "p",
    "revision-subtitle",
    "Build your understanding one review at a time."
  );

  headingGroup.append(eyebrow, heading, subtitle);

  const refreshButton = createButton(
    "Refresh progress",
    "revision-refresh-button",
    renderDashboard
  );

  header.append(headingGroup, refreshButton);

  const statsSection = createElement("section", "revision-stats");
  statsSection.setAttribute("aria-label", "Your revision statistics");

  const mainSection = createElement("section", "revision-main");
  mainSection.setAttribute("aria-label", "Flashcard revision");

  const librarySection = createElement("section", "revision-library");
  librarySection.setAttribute("aria-label", "Your flashcards");

  const liveRegion = createElement("p", "revision-live-region");
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

  function announce(message) {
    liveRegion.textContent = message;
  }

  function createStatCard(label, value, description) {
    const card = createElement("article", "revision-stat-card");

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

    card.append(labelElement, valueElement, descriptionElement);

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

  function renderEmptyState() {
    const emptyState = createElement("div", "revision-empty-state");

    const icon = createElement("div", "revision-empty-state__icon", "✦");
    icon.setAttribute("aria-hidden", "true");

    const title = createElement(
      "h2",
      "revision-empty-state__title",
      "Your revision space is ready"
    );

    const description = createElement(
      "p",
      "revision-empty-state__description",
      "You haven't created any flashcards yet. Open a reading document and generate flashcards to start building your revision collection."
    );

    emptyState.append(icon, title, description);

    return emptyState;
  }

  function renderNoDueCards() {
    const emptyState = createElement("div", "revision-empty-state");

    const icon = createElement("div", "revision-empty-state__icon", "✓");
    icon.setAttribute("aria-hidden", "true");

    const title = createElement(
      "h2",
      "revision-empty-state__title",
      "You're all caught up!"
    );

    const description = createElement(
      "p",
      "revision-empty-state__description",
      "There are no flashcards due right now. Come back when your next revision is scheduled."
    );

    emptyState.append(icon, title, description);

    return emptyState;
  }

  function renderDashboard() {
    if (isReviewing) return;

    session = null;
    sessionCards = [];
    currentIndex = 0;
    answerRevealed = false;

    renderStatistics();

    const cards = getAllFlashcards();

    mainSection.replaceChildren();

    if (!cards.length) {
      mainSection.append(renderEmptyState());
      renderLibrary(cards);
      return;
    }

    const stats = getRevisionStatistics();

    const intro = createElement("div", "revision-intro");

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
      stats.dueCards > 0 ? "Start revision session" : "No cards due yet",
      "revision-start-button",
      startRevision
    );

    startButton.disabled = stats.dueCards === 0;

    intro.append(title, description, startButton);
    mainSection.append(intro);

    renderLibrary(cards);
  }

  function renderLibrary(cards) {
    librarySection.replaceChildren();

    const heading = createElement(
      "h2",
      "revision-section-heading",
      `Your flashcards (${cards.length})`
    );

    librarySection.append(heading);

    if (!cards.length) return;

    const list = createElement("div", "revision-card-list");

    cards.forEach((card) => {
      const item = createElement("article", "revision-library-card");

      const content = createElement("div", "revision-library-card__content");

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

      content.append(question, type, dueDate);

      const removeButton = createButton(
        "Delete",
        "revision-delete-button",
        () => {
          const confirmed = window.confirm(
            "Delete this flashcard? This action cannot be undone."
          );

          if (!confirmed) return;

          deleteFlashcard(card.id);
          announce("Flashcard deleted.");
          renderDashboard();
        }
      );

      removeButton.setAttribute(
        "aria-label",
        `Delete flashcard: ${card.question || "Untitled flashcard"}`
      );

      item.append(content, removeButton);
      list.append(item);
    });

    librarySection.append(list);
  }

  function startRevision() {
  try {
    const result = createRevisionSession();
    
    if (!result || !result.cards || !result.cards.length) {
      renderDashboard();
      announce("There are no flashcards due for review.");
      return;
    }
    
    // The revision service returns the session directly,
    // not inside a result.session property.
    session = result;
    
    sessionCards = result.cards;
    currentIndex = 0;
    answerRevealed = false;
    isReviewing = true;
    
    renderCurrentCard();
    
    announce(
      `Revision started. ${sessionCards.length} cards to review.`
    );
    
  } catch (error) {
    console.error("Could not start revision session:", error);
    
    announce(
      "Something went wrong while starting your revision session."
    );
  }
}

  function renderCurrentCard() {
    mainSection.replaceChildren();

    if (currentIndex >= sessionCards.length) {
      renderSessionComplete();
      return;
    }

    const card = sessionCards[currentIndex];

    const progress = createElement("div", "revision-progress");

    const progressText = createElement(
      "p",
      "revision-progress__text",
      `Card ${currentIndex + 1} of ${sessionCards.length}`
    );

    const progressTrack = createElement("div", "revision-progress__track");
    const progressBar = createElement("div", "revision-progress__bar");

    const progressPercentage =
      ((currentIndex + 1) / sessionCards.length) * 100;

    progressBar.style.width = `${progressPercentage}%`;

    progressTrack.append(progressBar);
    progress.append(progressText, progressTrack);

    const cardPanel = createElement("article", "revision-review-card");

    const cardType = createElement(
      "p",
      "revision-review-card__type",
      card.type || "FLASHCARD"
    );

    const question = createElement(
      "h2",
      "revision-review-card__question",
      card.question || "What can you remember?"
    );

    const answerPanel = createElement("div", "revision-answer-panel");

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

      answerPanel.append(answerHeading, answer);

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

        source.append(sourceSummary, sourceText);
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

    cardPanel.append(cardType, question, answerPanel);

    const ratingSection = createElement("div", "revision-rating");

    if (answerRevealed) {
      const ratingHeading = createElement(
        "h3",
        "revision-rating__heading",
        "How well did you remember?"
      );

      const ratingButtons = createElement(
        "div",
        "revision-rating__buttons"
      );

      RATINGS.forEach((rating) => {
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

      ratingSection.append(ratingHeading, ratingButtons);
    }

    const exitButton = createButton(
      "End session",
      "revision-exit-button",
      () => {
        isReviewing = false;
        renderDashboard();
        announce("Revision session ended.");
      }
    );

    mainSection.append(progress, cardPanel, ratingSection, exitButton);
  }

  function submitRating(rating) {
    if (!answerRevealed || isReviewing === false) return;

    const card = sessionCards[currentIndex];

    try {
      recordReview(card.id, rating);
      markSessionCardReviewed(session.id, card.id);

      announce(`Card rated ${rating}.`);

      currentIndex += 1;
      answerRevealed = false;

      renderCurrentCard();
      renderStatistics();
    } catch (error) {
      console.error("Could not save flashcard review:", error);
      announce("Your review could not be saved. Please try again.");
    }
  }

  function renderSessionComplete() {
    mainSection.replaceChildren();

    const completion = createElement("div", "revision-complete");

    const icon = createElement("div", "revision-complete__icon", "✓");
    icon.setAttribute("aria-hidden", "true");

    const title = createElement(
      "h2",
      "revision-complete__title",
      "Session complete!"
    );

    const description = createElement(
      "p",
      "revision-complete__description",
      `You reviewed ${sessionCards.length} flashcard${sessionCards.length === 1 ? "" : "s"}. Great work!`
    );

    const finishButton = createButton(
      "Back to dashboard",
      "revision-start-button",
      () => {
        isReviewing = false;
        renderDashboard();
        announce("Revision session completed.");
      }
    );

    completion.append(icon, title, description, finishButton);
    mainSection.append(completion);

    renderStatistics();
    renderLibrary(getAllFlashcards());
  }

  renderDashboard();

  return {
    refresh: renderDashboard,

    destroy() {
      container.replaceChildren();
      container.classList.remove("revision-dashboard");
    }
  };
}