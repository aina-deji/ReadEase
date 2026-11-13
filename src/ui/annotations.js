import { AnnotationService } from "../services/learning/annotationService.js";

import {
  createElement
} from "../core/dom.js";


export function initializeAnnotations({
  readingContent,
  getDocument
}) {

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


  function getTextNodes() {

    const walker = document.createTreeWalker(
      readingContent,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes;

  }


  function getPlainText() {
    return getTextNodes()
      .map(node => node.textContent)
      .join("");
  }


  function getOffsets(range) {

    const nodes = getTextNodes();

    let position = 0;
    let start = null;
    let end = null;

    for (const node of nodes) {

      const length = node.textContent.length;

      if (node === range.startContainer) {
        start = position + range.startOffset;
      }

      if (node === range.endContainer) {
        end = position + range.endOffset;
      }

      position += length;

    }

    if (start === null || end === null) {
      return null;
    }

    return { start, end };

  }


  function restoreRange(start, end) {

    const nodes = getTextNodes();

    let position = 0;
    let startPoint = null;
    let endPoint = null;

    for (const node of nodes) {

      const length = node.textContent.length;
      const nodeEnd = position + length;

      if (!startPoint && start >= position && start <= nodeEnd) {
        startPoint = {
          node,
          offset: start - position
        };
      }

      if (!endPoint && end >= position && end <= nodeEnd) {
        endPoint = {
          node,
          offset: end - position
        };
      }

      position = nodeEnd;

    }

    if (!startPoint || !endPoint) return null;

    const range = document.createRange();

    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);

    return range;

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

    if (!selection || selection.isCollapsed) return;

    if (!readingContent.contains(selection.anchorNode)) return;

    if (!readingContent.contains(selection.focusNode)) return;

    const text = selection.toString().trim();

    if (!text) return;

    const range = selection.getRangeAt(0);

    const offsets = getOffsets(range);

    if (!offsets || offsets.end <= offsets.start) return;

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


  function renderHighlights() {

    const current = getDocument();

    if (!current) return;

    readingContent.replaceChildren();

    const paragraphs = current.content
      .split(/\n\s*\n/)
      .map(value => value.trim())
      .filter(Boolean);

    let globalOffset = 0;

    for (const paragraph of paragraphs) {

      const paragraphElement = createElement("p");

      const paragraphStart = globalOffset;
      const paragraphEnd = paragraphStart + paragraph.length;

      const highlights = annotations
        .filter(item => item.type === "highlight")
        .filter(item =>
          item.start < paragraphEnd &&
          item.end > paragraphStart
        )
        .sort((a, b) => a.start - b.start);

      let cursor = 0;

      for (const highlight of highlights) {

        const start = Math.max(
          0,
          highlight.start - paragraphStart
        );

        const end = Math.min(
          paragraph.length,
          highlight.end - paragraphStart
        );

        if (start < cursor || end <= start) continue;

        if (start > cursor) {
          paragraphElement.appendChild(
            document.createTextNode(
              paragraph.slice(cursor, start)
            )
          );
        }

        const mark = createElement("mark", {
          className: `saved-highlight ${highlight.color}`
        });

        mark.textContent = paragraph.slice(start, end);

        paragraphElement.appendChild(mark);

        cursor = end;

      }

      if (cursor < paragraph.length) {
        paragraphElement.appendChild(
          document.createTextNode(
            paragraph.slice(cursor)
          )
        );
      }

      readingContent.appendChild(paragraphElement);

      globalOffset = paragraphEnd + 2;

    }

  }


  function renderPanel() {

    const list = panel.querySelector(".annotations-list");

    list.replaceChildren();

    if (!annotations.length) {

      const empty = createElement("p", {
        className: "annotations-empty",
        text: "Your saved highlights, notes and bookmarks will appear here."
      });

      list.appendChild(empty);

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
      }[item.type];

      const heading = createElement("strong", {
        text: typeLabel
      });

      const quote = createElement("blockquote", {
        text: item.text
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

          const paragraph = range.startContainer.parentElement;

          paragraph?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

        }

        closePanel();

      });


      const deleteButton = createElement("button", {
        text: "Delete"
      });

      deleteButton.type = "button";

      deleteButton.addEventListener("click", async () => {

        await service.remove(item.id);

        await loadAnnotations();

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

    if (!selectedText || !selectedOffsets || !currentDocumentId) {
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

      console.error(error);

      window.alert("We couldn't save that annotation. Please try again.");

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

      await saveAnnotation("highlight", {
        color: button.dataset.color
      });

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

      const note = noteDialog.querySelector("textarea").value.trim();

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
    }

  };

}