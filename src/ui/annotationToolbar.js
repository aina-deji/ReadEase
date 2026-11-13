import { AnnotationService } from "../services/learning/annotationService.js";
import { SelectionService } from "../services/learning/selectionService.js";


const COLORS = {
  yellow: "#fce58a",
  green: "#b9edcf",
  blue: "#b9dafa",
  pink: "#f6c5d8"
};


function createDocumentId(title, content) {

  const value = `${title}::${content}`;

  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `document-${(hash >>> 0).toString(16)}`;

}


function createButton(label, className = "") {

  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.className = className;

  return button;

}


export class AnnotationToolbar {

  constructor({ container, documentData }) {

    this.container = container;

    this.documentId = createDocumentId(
      documentData.title,
      documentData.content
    );

    this.service = new AnnotationService();

    this.selectionService = new SelectionService(container);

    this.currentSelection = null;

    this.toolbar = null;

    this.panel = null;

    this.status = null;

    this.initialize();

  }


  initialize() {

    this.createInterface();

    this.bindEvents();

    this.loadAnnotations();

  }


  createInterface() {

    this.toolbar = document.createElement("div");

    this.toolbar.className = "annotation-toolbar hidden";

    this.toolbar.setAttribute("role", "toolbar");

    this.toolbar.setAttribute(
      "aria-label",
      "Text annotation tools"
    );

    const highlightButton = createButton("Highlight");

    highlightButton.addEventListener(
      "click",
      () => this.highlight("yellow")
    );

    this.toolbar.appendChild(highlightButton);


    const colors = Object.entries(COLORS);

    colors.forEach(([color, value]) => {

      const button = createButton(color);

      button.className = "annotation-color-button";

      button.style.setProperty("--annotation-color", value);

      button.setAttribute(
        "aria-label",
        `Highlight in ${color}`
      );

      button.addEventListener(
        "click",
        () => this.highlight(color)
      );

      this.toolbar.appendChild(button);

    });


    const noteButton = createButton("Add note");

    noteButton.addEventListener(
      "click",
      () => this.addNote()
    );

    this.toolbar.appendChild(noteButton);


    const bookmarkButton = createButton("Bookmark");

    bookmarkButton.addEventListener(
      "click",
      () => this.addBookmark()
    );

    this.toolbar.appendChild(bookmarkButton);


    this.container.parentElement.appendChild(this.toolbar);


    this.panel = document.createElement("section");

    this.panel.className = "annotations-panel";

    this.panel.setAttribute(
      "aria-label",
      "Saved annotations"
    );

    const heading = document.createElement("h2");

    heading.textContent = "My annotations";

    this.panel.appendChild(heading);


    this.status = document.createElement("p");

    this.status.className = "annotation-status";

    this.status.setAttribute("aria-live", "polite");

    this.panel.appendChild(this.status);


    this.list = document.createElement("div");

    this.list.className = "annotation-list";

    this.panel.appendChild(this.list);


    this.container.parentElement.after(this.panel);

  }


  bindEvents() {

    this.handleSelection = () => {

      requestAnimationFrame(() => this.showToolbar());

    };


    this.container.addEventListener(
      "pointerup",
      this.handleSelection
    );

    this.container.addEventListener(
      "keyup",
      this.handleSelection
    );


    this.toolbar.addEventListener(
      "pointerdown",
      event => event.preventDefault()
    );


    document.addEventListener(
      "keydown",
      this.handleKeyboard
    );

  }


  handleKeyboard = event => {

    if (event.key === "Escape") {
      this.hideToolbar();
    }

  };


  showToolbar() {

    const selection = this.selectionService.getSelection();

    if (!selection) {
      this.hideToolbar();
      return;
    }

    const browserSelection = window.getSelection();

    if (!browserSelection?.rangeCount) return;

    const range = browserSelection.getRangeAt(0);

    const rect = range.getBoundingClientRect();

    this.currentSelection = selection;

    this.toolbar.classList.remove("hidden");

    const toolbarRect = this.toolbar.getBoundingClientRect();

    const left = Math.max(
      8,
      Math.min(
        rect.left + rect.width / 2 - toolbarRect.width / 2,
        window.innerWidth - toolbarRect.width - 8
      )
    );

    let top = rect.top - toolbarRect.height - 12;

    if (top < 8) {
      top = rect.bottom + 12;
    }

    this.toolbar.style.left = `${left}px`;

    this.toolbar.style.top = `${top}px`;

  }


  hideToolbar() {

    this.toolbar.classList.add("hidden");

    this.currentSelection = null;

  }


  async highlight(color) {

    if (!this.currentSelection) return;

    try {

      await this.service.addHighlight(
        this.documentId,
        this.currentSelection,
        color
      );

      this.setStatus("Highlight saved.");

      await this.loadAnnotations();

      this.hideToolbar();

      this.selectionService.clearSelection();

    } catch (error) {

      console.error(error);

      this.setStatus("Unable to save highlight.");

    }

  }


  async addNote() {

    if (!this.currentSelection) return;

    const note = window.prompt(
      "What would you like to remember about this passage?"
    );

    if (note === null) return;

    if (!note.trim()) {
      this.setStatus("Please enter a note.");
      return;
    }

    try {

      await this.service.addNote(
        this.documentId,
        this.currentSelection,
        note
      );

      this.setStatus("Your note has been saved.");

      await this.loadAnnotations();

      this.hideToolbar();

      this.selectionService.clearSelection();

    } catch (error) {

      console.error(error);

      this.setStatus("Unable to save your note.");

    }

  }


  async addBookmark() {

    if (!this.currentSelection) return;

    try {

      await this.service.addBookmark(
        this.documentId,
        this.currentSelection
      );

      this.setStatus("Passage bookmarked.");

      await this.loadAnnotations();

      this.hideToolbar();

      this.selectionService.clearSelection();

    } catch (error) {

      console.error(error);

      this.setStatus("Unable to save bookmark.");

    }

  }


  async loadAnnotations() {

    const annotations = await this.service.getAll(
      this.documentId
    );

    this.renderHighlights(annotations);

    this.renderAnnotationList(annotations);

  }


  renderHighlights(annotations) {

    if (!window.CSS?.highlights || !window.Highlight) {
      return;
    }

    const colors = Object.keys(COLORS);

    colors.forEach(color => {
      CSS.highlights.delete(`readease-${color}`);
    });


    for (const color of colors) {

      const ranges = [];

      const highlights = annotations.filter(
        item =>
          item.type === "highlight" &&
          item.color === color
      );

      for (const annotation of highlights) {

        const range = this.createRange(
          annotation.start,
          annotation.end
        );

        if (range) ranges.push(range);

      }

      if (ranges.length) {

        CSS.highlights.set(
          `readease-${color}`,
          new Highlight(...ranges)
        );

      }

    }

  }


  createRange(start, end) {

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start
    ) {
      return null;
    }

    const paragraphs = [
      ...this.container.querySelectorAll("p")
    ];

    for (const paragraph of paragraphs) {

      const paragraphStart = Number(
        paragraph.dataset.start
      );

      const paragraphText = paragraph.textContent;

      const paragraphEnd =
        paragraphStart + paragraphText.length;

      const overlapStart = Math.max(start, paragraphStart);

      const overlapEnd = Math.min(end, paragraphEnd);

      if (overlapStart >= overlapEnd) continue;

      const range = document.createRange();

      const startPoint = this.getTextPoint(
        paragraph,
        overlapStart - paragraphStart
      );

      const endPoint = this.getTextPoint(
        paragraph,
        overlapEnd - paragraphStart
      );

      if (!startPoint || !endPoint) continue;

      range.setStart(startPoint.node, startPoint.offset);

      range.setEnd(endPoint.node, endPoint.offset);

      return range;

    }

    return null;

  }


  getTextPoint(paragraph, targetOffset) {

    const walker = document.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_TEXT
    );

    let currentOffset = 0;

    let node;

    while ((node = walker.nextNode())) {

      const length = node.textContent.length;

      if (targetOffset <= currentOffset + length) {

        return {
          node,
          offset: targetOffset - currentOffset
        };

      }

      currentOffset += length;

    }

    return null;

  }


  renderAnnotationList(annotations) {

    this.list.replaceChildren();

    if (!annotations.length) {

      const empty = document.createElement("p");

      empty.className = "annotations-empty";

      empty.textContent =
        "Your highlights, notes and bookmarks will appear here.";

      this.list.appendChild(empty);

      return;

    }


    for (const annotation of annotations) {

      const card = document.createElement("article");

      card.className = "annotation-item";


      const type = document.createElement("span");

      type.className = "annotation-type";

      type.textContent = annotation.type;


      const passage = document.createElement("blockquote");

      passage.textContent = annotation.text;


      card.append(type, passage);


      if (annotation.color) {

        const color = document.createElement("span");

        color.className = "annotation-color-indicator";

        color.style.backgroundColor =
          COLORS[annotation.color] || COLORS.yellow;

        color.setAttribute("aria-label", `${annotation.color} highlight`);

        card.appendChild(color);

      }


      if (annotation.note) {

        const note = document.createElement("p");

        note.className = "annotation-note";

        note.textContent = annotation.note;

        card.appendChild(note);


        const editButton = createButton("Edit note");

        editButton.addEventListener(
          "click",
          () => this.editNote(annotation)
        );

        card.appendChild(editButton);

      }


      const actions = document.createElement("div");

      actions.className = "annotation-actions";


      const jumpButton = createButton("Go to passage");

      jumpButton.addEventListener(
        "click",
        () => this.goToPassage(annotation)
      );


      const deleteButton = createButton("Delete");

      deleteButton.addEventListener(
        "click",
        () => this.deleteAnnotation(annotation.id)
      );


      actions.append(jumpButton, deleteButton);

      card.appendChild(actions);

      this.list.appendChild(card);

    }

  }


  async editNote(annotation) {

    const updatedNote = window.prompt(
      "Edit your note:",
      annotation.note
    );

    if (updatedNote === null || !updatedNote.trim()) {
      return;
    }

    try {

      await this.service.update(
        this.documentId,
        annotation.id,
        { note: updatedNote.trim() }
      );

      this.setStatus("Note updated.");

      await this.loadAnnotations();

    } catch (error) {

      console.error(error);

      this.setStatus("Unable to update note.");

    }

  }


  async deleteAnnotation(id) {

    if (!window.confirm("Delete this annotation?")) {
      return;
    }

    try {

      await this.service.remove(
        this.documentId,
        id
      );

      this.setStatus("Annotation deleted.");

      await this.loadAnnotations();

    } catch (error) {

      console.error(error);

      this.setStatus("Unable to delete annotation.");

    }

  }


  goToPassage(annotation) {

    const range = this.createRange(
      annotation.start,
      annotation.end
    );

    if (!range) {
      this.setStatus("This passage could not be located.");
      return;
    }

    const paragraph = range.startContainer.parentElement
      .closest("p");

    paragraph?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const selection = window.getSelection();

    selection.removeAllRanges();

    selection.addRange(range);

  }


  setStatus(message) {

    this.status.textContent = message;

  }


  destroy() {

    this.container.removeEventListener(
      "pointerup",
      this.handleSelection
    );

    this.container.removeEventListener(
      "keyup",
      this.handleSelection
    );

    document.removeEventListener(
      "keydown",
      this.handleKeyboard
    );

    this.toolbar.remove();

    this.panel.remove();

  }

}