import { AnnotationService } from "../services/learning/annotationService.js";
import { createElement } from "../core/dom.js";

const HIGHLIGHT_COLORS = ["yellow", "green", "blue"];
const PARAGRAPH_SEPARATOR = "\n\n";

export function initializeAnnotations({
  readingContent,
  getDocument
}) {
  if (!readingContent || typeof getDocument !== "function") {
    throw new Error("Annotation initialization requires readingContent and getDocument.");
  }

  const service = new AnnotationService();

  let annotations = [];
  let currentDocumentId = null;
  let selectedText = null;
  let selectedRange = null;
  let selectedOffsets = null;

  const toolbar = createElement("div", {
    className: "annotation-toolbar"
  });

  toolbar.innerHTML = `
    <button type="button" data-action="highlight" data-color="yellow">
      <span class="annotation-dot yellow"></span>
      Highlight
    </button>

    <button type="button" data-action="highlight" data-color="green">
      <span class="annotation-dot green"></span>
      Green
    </button>

    <button type="button" data-action="highlight" data-color="blue">
      <span class="annotation-dot blue"></span>
      Blue
    </button>

    <button type="button" data-action="note">
      Add note
    </button>

    <button type="button" data-action="bookmark">
      Bookmark
    </button>
  `;

  toolbar.setAttribute("aria-label", "Text selection tools");
  document.body.appendChild(toolbar);

  const panel = createElement("section", {
    className: "annotations-panel"
  });

  panel.innerHTML = `
    <div class="annotations-header">
      <div>
        <h2>My annotations</h2>
        <p>Saved highlights, notes and bookmarks.</p>
      </div>

      <button type="button" data-close aria-label="Close annotations">
        ×
      </button>
    </div>

    <div class="annotations-list"></div>
  `;

  document.body.appendChild(panel);

  const noteDialog = createElement("div", {
    className: "annotation-note-dialog"
  });

  noteDialog.innerHTML = `
    <form>
      <h2>Add a note</h2>

      <p class="note-selected-text"></p>

      <label for="annotationNoteInput">
        Your note
      </label>

      <textarea
        id="annotationNoteInput"
        maxlength="1000"
        placeholder="Write what you want to remember..."
        required
      ></textarea>

      <div class="annotation-note-actions">
        <button type="button" data-cancel>Cancel</button>
        <button type="submit">Save note</button>
      </div>
    </form>
  `;

  document.body.appendChild(noteDialog);

  // Use exactly the same paragraph normalization everywhere.
  function getParagraphs() {
    const current = getDocument();

    if (!current?.content) return [];

    return current.content
      .split(/\n\s*\n/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  function getCanonicalText() {
    return getParagraphs().join(PARAGRAPH_SEPARATOR);
  }

  function getDocumentId() {
    const current = getDocument();

    if (!current) return null;

    const value = `${current.title}\n${current.content}`;

    let hash = 2166136261;

    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `document-${(hash >>> 0).toString(16)}`;
  }

  function getParagraphElements() {
    return Array.from(readingContent.querySelectorAll(":scope > p"));
  }

  function getParagraphStart(index, paragraphs = getParagraphs()) {
    let position = 0;

    for (let i = 0; i < index; i++) {
      position += paragraphs[i].length + PARAGRAPH_SEPARATOR.length;
    }

    return position;
  }

  function getLocalOffset(paragraph, container, offset) {
    const range = document.createRange();

    range.selectNodeContents(paragraph);
    range.setEnd(container, offset);

    return range.toString().length;
  }

  // Convert a DOM selection into offsets in the canonical document text.
  function getOffsets(range) {
    const paragraphs = getParagraphs();
    const paragraphElements = getParagraphElements();

    if (paragraphs.length !== paragraphElements.length) {
      return null;
    }

    function locateBoundary(container, offset) {
      const element = container.nodeType === Node.ELEMENT_NODE
        ? container
        : container.parentElement;

      const paragraph = element?.closest("p");

      if (!paragraph || !readingContent.contains(paragraph)) {
        return null;
      }

      const paragraphIndex = paragraphElements.indexOf(paragraph);

      if (paragraphIndex === -1) return null;

      const localOffset = getLocalOffset(
        paragraph,
        container,
        offset
      );

      return getParagraphStart(paragraphIndex, paragraphs) + localOffset;
    }

    const start = locateBoundary(
      range.startContainer,
      range.startOffset
    );

    const end = locateBoundary(
      range.endContainer,
      range.endOffset
    );

    if (start === null || end === null || end <= start) {
      return null;
    }

    return { start, end };
  }

  // Find the DOM text position corresponding to a canonical offset.
  function locateTextPosition(paragraph, localOffset) {
    const walker = document.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_TEXT
    );

    let node;
    let position = 0;
    let lastNode = null;

    while ((node = walker.nextNode())) {
      const length = node.textContent.length;
      lastNode = node;

      if (localOffset <= position + length) {
        return {
          node,
          offset: Math.max(0, localOffset - position)
        };
      }

      position += length;
    }

    if (lastNode) {
      return {
        node: lastNode,
        offset: lastNode.textContent.length
      };
    }

    return null;
  }

  function restoreBoundary(globalOffset, paragraphs, paragraphElements) {
    for (let index = 0; index < paragraphs.length; index++) {
      const paragraphStart = getParagraphStart(index, paragraphs);
      const paragraphEnd = paragraphStart + paragraphs[index].length;

      if (
        globalOffset >= paragraphStart &&
        globalOffset <= paragraphEnd
      ) {
        return locateTextPosition(
          paragraphElements[index],
          globalOffset - paragraphStart
        );
      }
    }

    // If the offset falls inside a paragraph separator,
    // place it at the nearest paragraph boundary.
    for (let index = 0; index < paragraphs.length - 1; index++) {
      const paragraphEnd =
        getParagraphStart(index, paragraphs) +
        paragraphs[index].length;

      const nextParagraphStart =
        paragraphEnd + PARAGRAPH_SEPARATOR.length;

      if (
        globalOffset > paragraphEnd &&
        globalOffset < nextParagraphStart
      ) {
        return locateTextPosition(
          paragraphElements[index + 1],
          0
        );
      }
    }

    return null;
  }

  function restoreRange(start, end) {
    const paragraphs = getParagraphs();
    const paragraphElements = getParagraphElements();

    if (paragraphs.length !== paragraphElements.length) {
      return null;
    }

    const startPoint = restoreBoundary(
      start,
      paragraphs,
      paragraphElements
    );

    const endPoint = restoreBoundary(
      end,
      paragraphs,
      paragraphElements
    );

    if (!startPoint || !endPoint) return null;

    const range = document.createRange();

    try {
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);

      return range;
    } catch {
      return null;
    }
  }

  function hideToolbar() {
    toolbar.classList.remove("visible");
  }

  function showToolbar(range) {
    const rect = range.getBoundingClientRect();

    toolbar.classList.add("visible");

    const toolbarWidth = toolbar.offsetWidth;
    const toolbarHeight = toolbar.offsetHeight;

    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - toolbarWidth - 8,
        rect.left + rect.width / 2 - toolbarWidth / 2
      )
    );

    const top = Math.max(
      8,
      rect.top - toolbarHeight - 12
    );

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top + window.scrollY}px`;
  }

  function getSelection() {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return;
    }

    if (
      !readingContent.contains(selection.anchorNode) ||
      !readingContent.contains(selection.focusNode)
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    const offsets = getOffsets(range);

    if (!offsets) return;

    const canonicalText = getCanonicalText();
    const text = canonicalText.slice(offsets.start, offsets.end);

    if (!text.trim()) return;

    selectedText = text;
    selectedRange = range.cloneRange();
    selectedOffsets = offsets;

    showToolbar(range);
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();

    selectedText = null;
    selectedRange = null;
    selectedOffsets = null;

    hideToolbar();
  }

  function renderParagraphHighlights(
    paragraphElement,
    paragraph,
    paragraphStart
  ) {
    const paragraphEnd = paragraphStart + paragraph.length;

    const relevant = annotations
      .filter(item =>
        item.type === "highlight" &&
        Number.isFinite(item.start) &&
        Number.isFinite(item.end) &&
        item.start < paragraphEnd &&
        item.end > paragraphStart
      );

    if (!relevant.length) {
      paragraphElement.textContent = paragraph;
      return;
    }

    const boundaries = new Set([0, paragraph.length]);

    relevant.forEach(item => {
      boundaries.add(
        Math.max(0, item.start - paragraphStart)
      );

      boundaries.add(
        Math.min(paragraph.length, item.end - paragraphStart)
      );
    });

    const sorted = [...boundaries]
      .sort((a, b) => a - b);

    for (let index = 0; index < sorted.length - 1; index++) {
      const start = sorted[index];
      const end = sorted[index + 1];

      if (end <= start) continue;

      const covering = relevant
        .filter(item =>
          item.start < paragraphStart + end &&
          item.end > paragraphStart + start
        )
        .sort((a, b) =>
          new Date(a.createdAt || 0) -
          new Date(b.createdAt || 0)
        );

      const text = paragraph.slice(start, end);

      if (!covering.length) {
        paragraphElement.appendChild(
          document.createTextNode(text)
        );

        continue;
      }

      // When highlights overlap, the newest one determines the color.
      const activeHighlight = covering[covering.length - 1];

      const color = HIGHLIGHT_COLORS.includes(activeHighlight.color)
        ? activeHighlight.color
        : "yellow";

      const mark = createElement("mark", {
        className: `saved-highlight ${color}`
      });

      mark.textContent = text;

      paragraphElement.appendChild(mark);
    }
  }

  function renderHighlights() {
    const paragraphs = getParagraphs();

    readingContent.replaceChildren();

    paragraphs.forEach((paragraph, index) => {
      const paragraphElement = createElement("p");

      const paragraphStart = getParagraphStart(
        index,
        paragraphs
      );

      renderParagraphHighlights(
        paragraphElement,
        paragraph,
        paragraphStart
      );

      readingContent.appendChild(paragraphElement);
    });
  }

  function renderPanel() {
    const list = panel.querySelector(".annotations-list");

    list.replaceChildren();

    if (!annotations.length) {
      list.appendChild(
        createElement("p", {
          className: "annotations-empty",
          text: "Your saved highlights, notes and bookmarks will appear here."
        })
      );

      return;
    }

    for (const item of annotations) {
      const card = createElement("article", {
        className: "annotation-item"
      });

      const typeLabel = {
        highlight: "Highlight",
        note: "Personal note",
        bookmark: "Bookmark"
      }[item.type] || "Annotation";

      const heading = createElement("strong", {
        text: typeLabel
      });

      const quote = createElement("blockquote", {
        text: item.text || ""
      });

      card.append(heading, quote);

      if (item.note) {
        card.appendChild(
          createElement("p", {
            className: "annotation-note-preview",
            text: item.note
          })
        );
      }

      const actions = createElement("div", {
        className: "annotation-item-actions"
      });

      const jumpButton = createElement("button", {
        text: "Go to passage"
      });

      jumpButton.type = "button";

      jumpButton.addEventListener("click", () => {
        const range = restoreRange(item.start, item.end);

        if (range) {
          const element = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement;

          element?.closest("p")?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }

        closePanel();
      });

      const deleteButton = createElement("button", {
        text: "Delete"
      });

      deleteButton.type = "button";

      deleteButton.addEventListener("click", async () => {
        try {
          await service.remove(item.id);
          await loadAnnotations();
        } catch (error) {
          console.error("Could not delete annotation:", error);
          window.alert("We couldn't delete that annotation. Please try again.");
        }
      });

      actions.append(jumpButton, deleteButton);
      card.appendChild(actions);

      list.appendChild(card);
    }
  }

  async function loadAnnotations() {
    if (!currentDocumentId) return;

    annotations = await service.getAll(currentDocumentId);

    renderHighlights();
    renderPanel();
  }

  async function saveAnnotation(type, extra = {}) {
    if (
      !selectedText ||
      !selectedOffsets ||
      !currentDocumentId
    ) {
      return;
    }

    try {
      await service.add(currentDocumentId, {
        type,
        text: selectedText,
        start: selectedOffsets.start,
        end: selectedOffsets.end,
        color: extra.color || null,
        note: extra.note || ""
      });

      clearSelection();

      await loadAnnotations();
    } catch (error) {
      console.error("Could not save annotation:", error);

      window.alert(
        "We couldn't save that annotation. Please try again."
      );
    }
  }

  function openPanel() {
    panel.classList.add("visible");
    renderPanel();
  }

  function closePanel() {
    panel.classList.remove("visible");
  }

  function openNoteDialog() {
    if (!selectedText) return;

    noteDialog.querySelector(".note-selected-text").textContent =
      selectedText;

    noteDialog.classList.add("visible");
    noteDialog.querySelector("textarea").focus();
  }

  function closeNoteDialog() {
    noteDialog.classList.remove("visible");
    noteDialog.querySelector("form").reset();
  }

  toolbar.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;

    if (action === "highlight") {
      const color = HIGHLIGHT_COLORS.includes(button.dataset.color)
        ? button.dataset.color
        : "yellow";

      await saveAnnotation("highlight", { color });
    }

    if (action === "bookmark") {
      await saveAnnotation("bookmark");
    }

    if (action === "note") {
      hideToolbar();
      openNoteDialog();
    }
  });

  noteDialog.querySelector("form").addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const note = noteDialog
        .querySelector("textarea")
        .value
        .trim();

      if (!note) return;

      await saveAnnotation("note", { note });

      closeNoteDialog();
    }
  );

  noteDialog.querySelector("[data-cancel]").addEventListener(
    "click",
    closeNoteDialog
  );

  panel.querySelector("[data-close]").addEventListener(
    "click",
    closePanel
  );

  readingContent.addEventListener("mouseup", () => {
    setTimeout(getSelection, 10);
  });

  readingContent.addEventListener("touchend", () => {
    setTimeout(getSelection, 150);
  });

  document.addEventListener("mousedown", event => {
    if (
      !toolbar.contains(event.target) &&
      !readingContent.contains(event.target)
    ) {
      hideToolbar();
    }
  });

  return {
    async open() {
      const current = getDocument();

      if (!current) return;

      currentDocumentId = getDocumentId();

      clearSelection();

      await loadAnnotations();
    },

    openPanel,

    closePanel,

    async refresh() {
      await loadAnnotations();
    },

    destroy() {
      toolbar.remove();
      panel.remove();
      noteDialog.remove();
      clearSelection();
    }
  };
}