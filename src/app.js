import {
  getElement,
  createElement,
  setText
} from "./core/dom.js";

import {
  SpeechService
} from "./services/speech/speechService.js";

import {
  initializeAnnotations
} from "./ui/annotations.js";

import {
  mountFlashcards
} from "./ui/flashcards.js";

import {
  addFlashcards,
  getRevisionStatistics
} from "./services/learning/revisionService.js";

import {
  segmentText
} from "./algorithms/textSegmenter.js";

import {
  extractTerms
} from "./algorithms/termExtractor.js";

import {
  scoreSentences
} from "./algorithms/sentenceScorer.js";

import {
  generateFlashcards
} from "./algorithms/clozeGenerator.js";


// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const SAMPLE_DOCUMENT = {
  title: "Understanding Photosynthesis",

  content: `Photosynthesis is the process through which green plants make their own food using light energy.

This process mainly takes place in the chloroplasts of plant cells. Chlorophyll, the green pigment found in chloroplasts, absorbs light energy from the sun.

During photosynthesis, plants take in carbon dioxide from the atmosphere and water from the soil. Using light energy, they convert these substances into glucose and oxygen.

Glucose provides energy for the plant and can also be stored for later use. Oxygen is released into the atmosphere as a by-product.

Photosynthesis is important because it provides food for plants and supports nearly all food chains on Earth. It also helps maintain the balance of oxygen and carbon dioxide in the atmosphere.`
};

const DEFAULT_SETTINGS = {
  fontFamily: "serif",
  fontSize: 19,
  lineSpacing: 1.9,
  letterSpacing: 0,
  theme: "light",
  readingRuler: false
};

const FONT_FAMILIES = {
  serif: '"Source Serif 4", Georgia, serif',
  atkinson: '"Atkinson Hyperlegible", Arial, sans-serif',
  sans: '"Open Sans", Arial, sans-serif',
  system: "system-ui, sans-serif"
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const PDFJS_VERSION = "4.10.38";

const PDFJS_MODULE_URL =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;

const PDFJS_WORKER_URL =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const MAMMOTH_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js";

const ROUTE_PAGES = ["reading", "revision", "notes"];
const DOCUMENT_SESSION_KEY = "readease:currentDocument";

let pdfJsPromise = null;
let mammothPromise = null;


// --------------------------------------------------
// APPLICATION
// --------------------------------------------------

export function initializeApp() {

  const elements = {
    sidebar: getElement("#sidebar"),
    mobileMenuButton: getElement("#mobileMenuButton"),
    mobileOverlay: getElement("#mobileOverlay"),

    documentTitle: getElement("#documentTitle"),
    documentContent: getElement("#documentContent"),
    fileInput: getElement("#fileInput"),

    uploadDropzone: getElement("#uploadDropzone"),
    uploadFileStatus: getElement("#uploadFileStatus"),

    wordCount: getElement("#wordCount"),
    formMessage: getElement("#formMessage"),

    startReadingButton: getElement("#startReadingButton"),
    sampleButton: getElement("#sampleButton"),

    importSection: getElement("#importSection"),
    readerSection: getElement("#readerSection"),

    readingTitle: getElement("#readingTitle"),
    readingContent: getElement("#readingContent"),
    readingWordCount: getElement("#readingWordCount"),
    readingCard: getElement("#readingCard"),

    editDocumentButton: getElement("#editDocumentButton"),

    increaseFontButton: getElement("#increaseFontButton"),
    decreaseFontButton: getElement("#decreaseFontButton"),

    focusModeButton: getElement("#focusModeButton"),

    pageHeading: getElement("#pageHeading"),
    breadcrumbCurrent: getElement("#breadcrumbCurrent"),

    accessibilityButton: getElement("#accessibilityButton"),
    accessibilityPanel: getElement("#accessibilityPanel"),
    closeAccessibilityButton: getElement("#closeAccessibilityButton"),

    fontFamilySelect: getElement("#fontFamilySelect"),
    lineSpacingRange: getElement("#lineSpacingRange"),
    lineSpacingValue: getElement("#lineSpacingValue"),

    letterSpacingRange: getElement("#letterSpacingRange"),
    letterSpacingValue: getElement("#letterSpacingValue"),

    readingThemeSelect: getElement("#readingThemeSelect"),
    readingRulerToggle: getElement("#readingRulerToggle"),
    resetReadingSettings: getElement("#resetReadingSettings"),

    readingRuler: getElement("#readingRuler"),

    speechPlayButton: getElement("#speechPlayButton"),
    speechStatus: getElement("#speechStatus"),

    annotationsButton: getElement("#annotationsButton"),
    sidebarAnnotationsButton: getElement("#sidebarAnnotationsButton"),

    sidebarReadingButton: getElement("#sidebarReadingButton"),
    revisionNavButton: getElement("#revisionNavButton"),
    revisionNavCount: getElement("#revisionNavCount"),

    readingPage: getElement("#readingPage"),
    revisionPage: getElement("#revisionPage"),
    notesPage: getElement("#notesPage"),

    revisionDashboardContainer: getElement("#revisionDashboardContainer"),

    generateFlashcardsButton: getElement("#generateFlashcardsButton"),
    flashcardGenerationStatus: getElement("#flashcardGenerationStatus"),

    notesPageContent: getElement("#notesPageContent")
  };


  // --------------------------------------------------
  // APPLICATION STATE
  // --------------------------------------------------

  let settings = { ...DEFAULT_SETTINGS };
  let focusMode = false;
  let currentDocument = null;
  let activePage = "reading";
  let currentView = "editor";
  let revisionDashboard = null;

  const speech = new SpeechService();


  // --------------------------------------------------
  // ANNOTATIONS
  // --------------------------------------------------

  const annotationTools = initializeAnnotations({
    readingContent: elements.readingContent,
    getDocument: () => currentDocument
  });


  // --------------------------------------------------
  // GENERAL HELPERS
  // --------------------------------------------------

  function getWordCount(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/u).length;
  }

  function updateWordCount() {
    const count = getWordCount(elements.documentContent.value);
    setText(
      elements.wordCount,
      `${count.toLocaleString()} ${count === 1 ? "word" : "words"}`
    );
  }

  function showMessage(message) {
    setText(elements.formMessage, message);
  }

  function setUploadStatus(message) {
    setText(elements.uploadFileStatus, message);
  }

  function setGenerationStatus(message) {
    setText(elements.flashcardGenerationStatus, message);
  }


  // --------------------------------------------------
  // MOBILE NAVIGATION
  // --------------------------------------------------

  function closeMobileMenu() {
    elements.sidebar.classList.remove("open");
    elements.mobileOverlay.classList.remove("visible");
    elements.mobileMenuButton.setAttribute("aria-expanded", "false");
  }

  function toggleMobileMenu() {
    const isOpen = elements.sidebar.classList.toggle("open");
    elements.mobileOverlay.classList.toggle("visible", isOpen);
    elements.mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  }


  // --------------------------------------------------
  // REVISION DASHBOARD
  // --------------------------------------------------

  function refreshRevisionDashboard() {
    if (!revisionDashboard) {
      revisionDashboard = mountFlashcards(
        elements.revisionDashboardContainer
      );
    } else {
      revisionDashboard.refresh();
    }
    updateRevisionCount();
  }

  function updateRevisionCount() {
    const stats = getRevisionStatistics();
    const count = stats.dueCards;

    setText(elements.revisionNavCount, String(count));

    if (count === 0) {
      elements.revisionNavCount.setAttribute("hidden", "");
    } else {
      elements.revisionNavCount.removeAttribute("hidden");
    }
  }


  // --------------------------------------------------
  // NOTES PAGE
  // --------------------------------------------------

  function renderNotesPage() {
    elements.notesPageContent.replaceChildren();

    const message = createElement("p", {
      text: currentDocument
        ? "Open My annotations while reading to view and manage the annotations for your current document."
        : "Open a reading document and start saving useful notes and highlights."
    });

    elements.notesPageContent.append(message);

    const openButton = createElement("button", {
      className: "button button-primary",
      text: "Go to reading"
    });

    openButton.type = "button";

    openButton.addEventListener("click", () => {
      navigateTo("reading");
    });

    elements.notesPageContent.append(openButton);
  }


  // --------------------------------------------------
  // ROUTING
  // --------------------------------------------------

  function saveDocumentToSession() {
    try {
      if (currentDocument) {
        sessionStorage.setItem(
          DOCUMENT_SESSION_KEY,
          JSON.stringify(currentDocument)
        );
      } else {
        sessionStorage.removeItem(DOCUMENT_SESSION_KEY);
      }
    } catch (error) {
      console.warn("Could not persist document:", error);
    }
  }

  function loadDocumentFromSession() {
    try {
      const raw = sessionStorage.getItem(DOCUMENT_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.title && parsed?.content) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  function parseRoute() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const page = ROUTE_PAGES.includes(parts[0]) ? parts[0] : "reading";

    let view = null;
    if (parts[1] === "reader") view = "reader";
    if (parts[1] === "editor") view = "editor";

    return { page, view };
  }

  function buildHash(page, view) {
    if (page === "reading") {
      return `#/reading/${view === "reader" ? "reader" : "editor"}`;
    }
    return `#/${page}`;
  }

  function writeRoute(page, view, usePush) {
    const hash = buildHash(page, view);
    if (window.location.hash === hash) return;

    const state = { app: "readease", page, view };

    if (usePush) {
      window.history.pushState(state, "", hash);
    } else {
      window.history.replaceState(state, "", hash);
    }
  }

  function updateNavigationButtons() {
    const buttons = [
      elements.sidebarReadingButton,
      elements.sidebarAnnotationsButton,
      elements.revisionNavButton
    ];

    buttons.forEach(button => {
      const isActive = button.dataset.page === activePage;
      button.classList.toggle("active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function updateDocumentView() {
    const showingReader =
      currentView === "reader" && Boolean(currentDocument);

    elements.readerSection.classList.toggle("hidden", !showingReader);
    elements.importSection.classList.toggle("hidden", showingReader);
    elements.pageHeading.classList.toggle("hidden", showingReader);

    document.title = showingReader
      ? `${currentDocument.title} — ReadEase`
      : "ReadEase — Read. Understand. Remember.";
  }

  function navigateTo(page, options = {}) {
    const { history: updateHistory = true } = options;

    if (!ROUTE_PAGES.includes(page)) return;

    // Ensure Focus Mode is turned off when navigating
    exitFocusMode();

    activePage = page;

    saveDocumentToSession();

    const showingReader =
      page === "reading" &&
      currentView === "reader" &&
      Boolean(currentDocument);

    const view = showingReader ? "reader" : "editor";

    writeRoute(page, view, updateHistory);

    updateDocumentView();

    elements.readingPage.classList.toggle("hidden", page !== "reading");
    elements.revisionPage.classList.toggle("hidden", page !== "revision");
    elements.notesPage.classList.toggle("hidden", page !== "notes");

    const pageNames = {
      reading: currentDocument?.title || "My reading",
      revision: "Revision",
      notes: "My notes"
    };

    setText(elements.breadcrumbCurrent, pageNames[page] || "Workspace");

    updateNavigationButtons();
    closeMobileMenu();

    if (page === "revision") refreshRevisionDashboard();
    if (page === "notes") renderNotesPage();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  // --------------------------------------------------
  // SPEECH
  // --------------------------------------------------

  function setSpeechStatus(message) {
    setText(elements.speechStatus, message);
  }

  function updateSpeechControls(state) {
    const playing = state === "playing";
    const paused = state === "paused";
    const button = elements.speechPlayButton;

    button.classList.toggle("is-playing", playing);
    button.setAttribute("aria-pressed", String(playing));

    if (playing) {
      button.setAttribute("aria-label", "Pause read aloud");
      button.title = "Pause read aloud";
      setSpeechStatus("Reading aloud...");
    } else if (paused) {
      button.setAttribute("aria-label", "Resume read aloud");
      button.title = "Resume read aloud";
      setSpeechStatus("Playback paused");
    } else if (state === "ended") {
      button.setAttribute("aria-label", "Play again");
      button.title = "Play again";
      setSpeechStatus("Finished reading");
    } else if (state === "error") {
      button.setAttribute("aria-label", "Try reading aloud again");
      button.title = "Try again";
      setSpeechStatus("Unable to continue playback");
    } else {
      button.setAttribute("aria-label", "Play aloud");
      button.title = "Play aloud";
      setSpeechStatus("Ready when you are");
    }

    button.disabled = !speech.supported;
  }

  speech.onStateChange = updateSpeechControls;

  speech.onError = message => {
    setSpeechStatus(message);
    updateSpeechControls("error");
  };

  if (!speech.supported) {
    elements.speechPlayButton.disabled = true;
    setSpeechStatus("Text-to-speech is not supported in this browser.");
  }


  // --------------------------------------------------
  // READING CONTENT
  // --------------------------------------------------

  function renderReadingContent(content) {
    elements.readingContent.replaceChildren();

    const paragraphs = content
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      const paragraphElement = createElement("p", { text: paragraph });
      elements.readingContent.appendChild(paragraphElement);
    }
  }


  // --------------------------------------------------
  // OPEN READER
  // --------------------------------------------------

  async function openReader(title, content) {
    let cleanTitle = title.trim() || "Untitled reading";
    
    // Auto-fix crazy generated filenames
    if (cleanTitle.match(/^[a-zA-Z0-9-]{20,}$/)) {
      cleanTitle = "Imported Document";
    }

    const cleanContent = content.trim();

    if (!cleanContent) {
      showMessage("Please add some reading material before continuing.");
      return;
    }

    currentDocument = {
      title: cleanTitle,
      content: cleanContent
    };

    saveDocumentToSession();

    speech.stop();

    setText(elements.readingTitle, cleanTitle);
    setText(
      elements.readingWordCount,
      `${getWordCount(cleanContent).toLocaleString()} words`
    );

    renderReadingContent(cleanContent);

    elements.importSection.classList.add("hidden");
    elements.readerSection.classList.remove("hidden");
    elements.pageHeading.classList.add("hidden");

    setText(elements.breadcrumbCurrent, cleanTitle);
    document.title = `${cleanTitle} — ReadEase`;

    setGenerationStatus("");

    applySettings();

    try {
      await annotationTools.open();
    } catch (error) {
      console.warn("Annotations could not load:", error);
    }

    currentView = "reader";

    navigateTo("reading");
  }


  // --------------------------------------------------
  // RETURN TO EDITOR
  // --------------------------------------------------

  function returnToEditor() {
    speech.stop();
    annotationTools.closePanel();

    exitFocusMode();
    closeAccessibilityPanel();

    currentView = "editor";
    navigateTo("reading");
    elements.documentTitle.focus();
  }


  // --------------------------------------------------
  // PDF.JS LOADER
  // --------------------------------------------------

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_MODULE_URL)
        .then(pdfjs => {
          pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
          return pdfjs;
        })
        .catch(error => {
          pdfJsPromise = null;
          throw new Error(
            "The PDF reader could not load. Check your internet connection and try again."
          );
        });
    }
    return pdfJsPromise;
  }


  // --------------------------------------------------
  // MAMMOTH.JS LOADER
  // --------------------------------------------------

  async function loadMammoth() {
    if (window.mammoth) return window.mammoth;

    if (!mammothPromise) {
      mammothPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = MAMMOTH_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
          if (window.mammoth) {
            resolve(window.mammoth);
          } else {
            reject(new Error("The Word document reader could not initialize."));
          }
        };
        script.onerror = () => {
          reject(new Error("The Word document reader could not load. Check your internet connection."));
        };
        document.head.appendChild(script);
      }).catch(error => {
        mammothPromise = null;
        throw error;
      });
    }

    return mammothPromise;
  }


  // --------------------------------------------------
  // DOCX TEXT EXTRACTION
  // --------------------------------------------------

  async function extractDocxText(file) {
    setUploadStatus("Preparing Word document reader...");
    const mammoth = await loadMammoth();
    setUploadStatus("Extracting Word document text...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || "";
    } catch (error) {
      console.error("DOCX extraction failed:", error);
      throw new Error(
        "We couldn't read this Word document. It may be damaged, encrypted or unsupported."
      );
    }
  }


  // --------------------------------------------------
  // PDF TEXT EXTRACTION
  // --------------------------------------------------

  function extractPageText(textContent) {
    const items = textContent.items.filter(item =>
      typeof item.str === "string" && item.str.trim().length > 0
    );

    if (!items.length) return "";

    const lines = [];
    let currentLine = "";
    let previousY = null;
    let previousEndX = null;

    function finishLine() {
      const cleaned = currentLine.trim();
      if (cleaned) lines.push(cleaned);
      currentLine = "";
      previousEndX = null;
    }

    for (const item of items) {
      const text = item.str;
      const x = item.transform?.[4];
      const y = item.transform?.[5];

      if (
        previousY !== null &&
        typeof y === "number" &&
        Math.abs(y - previousY) > 3
      ) {
        const verticalGap = Math.abs(y - previousY);
        finishLine();
        if (verticalGap > 16) lines.push("");
      }

      if (
        currentLine &&
        typeof x === "number" &&
        previousEndX !== null &&
        x - previousEndX > 2
      ) {
        currentLine += " ";
      }

      currentLine += text;

      if (typeof x === "number" && typeof item.width === "number") {
        previousEndX = x + item.width;
      }

      if (typeof y === "number") previousY = y;

      if (item.hasEOL) finishLine();
    }

    finishLine();
    return lines.join("\n").trim();
  }

  async function extractPdfText(file) {
    setUploadStatus("Preparing PDF reader...");
    const pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();

    let loadingTask = null;
    let pdf = null;

    try {
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      pdf = await loadingTask.promise;

      const extractedPages = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setUploadStatus(
          `Extracting PDF text: page ${pageNumber} of ${pdf.numPages}...`
        );

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = extractPageText(textContent);

        if (pageText) extractedPages.push(pageText);
      }

      return extractedPages.join("\n\n").trim();
    } catch (error) {
      if (error?.name === "PasswordException") {
        throw new Error(
          "This PDF is password-protected. Please upload an unlocked copy."
        );
      }

      if (
        error?.name === "InvalidPDFException" ||
        error?.name === "MissingPDFException"
      ) {
        throw new Error(
          "This PDF appears to be damaged or invalid. Please try another file."
        );
      }

      throw error;
    } finally {
      if (pdf) {
        try { await pdf.destroy(); } catch (error) {
          console.warn("Could not close PDF document:", error);
        }
      } else if (loadingTask) {
        try { await loadingTask.destroy(); } catch (error) {
          console.warn("Could not close PDF loading task:", error);
        }
      }
    }
  }


  // --------------------------------------------------
  // FILE VALIDATION
  // --------------------------------------------------

  function validateFile(file) {
    if (!file) {
      throw new Error("Please select a file to upload.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File is too large. Maximum file size is 15 MB.");
    }

    const fileName = file.name.toLowerCase();
    const extension = fileName.split(".").pop();
    const supportedExtensions = ["txt", "pdf", "docx"];

    if (!supportedExtensions.includes(extension)) {
      throw new Error(
        "Unsupported file type. Please upload a TXT, PDF or DOCX file."
      );
    }

    return extension;
  }


  // --------------------------------------------------
  // FILE IMPORT
  // --------------------------------------------------

  async function processFile(file) {
    if (!file) return;

    elements.startReadingButton.disabled = true;
    showMessage("");

    try {
      const extension = validateFile(file);
      setUploadStatus(`Reading ${file.name}...`);

      let content = "";

      if (extension === "txt") {
        content = await file.text();
        content = content.replace(/^\uFEFF/, "");
      }

      if (extension === "pdf") {
        content = await extractPdfText(file);
      }

      if (extension === "docx") {
        content = await extractDocxText(file);
      }

      if (!content.trim()) {
        if (extension === "pdf") {
          throw new Error(
            "No selectable text was found in this PDF. It may be a scanned document containing images. OCR support is not included yet."
          );
        }
        throw new Error("No readable text was found in this file.");
      }

      const cleanTitle = file.name.replace(/\.[^.]+$/, "");

      elements.documentTitle.value = cleanTitle;
      elements.documentContent.value = content.trim();

      updateWordCount();
      setUploadStatus(`Ready: ${file.name}`);
      showMessage("");

    } catch (error) {
      console.error("File import failed:", error);
      showMessage(
        error.message ||
        "We couldn't read that file. Please try another one."
      );
      setUploadStatus("File import failed.");
    } finally {
      elements.startReadingButton.disabled = false;
      elements.fileInput.value = "";
    }
  }


  // --------------------------------------------------
  // DRAG AND DROP
  // --------------------------------------------------

  function initializeDropzone() {
    const dropzone = elements.uploadDropzone;

    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
      });
    });

    dropzone.addEventListener("drop", event => {
      const file = event.dataTransfer?.files?.[0];
      if (file) processFile(file);
    });
  }


  // --------------------------------------------------
  // ACCESSIBILITY SETTINGS
  // --------------------------------------------------

  function applySettings() {
    const content = elements.readingContent;

    content.style.fontFamily = FONT_FAMILIES[settings.fontFamily];
    content.style.fontSize = `${settings.fontSize}px`;
    content.style.lineHeight = settings.lineSpacing;
    content.style.letterSpacing = `${settings.letterSpacing}px`;

    elements.readingCard.dataset.theme = settings.theme;

    elements.fontFamilySelect.value = settings.fontFamily;
    elements.lineSpacingRange.value = settings.lineSpacing;
    elements.lineSpacingValue.value = settings.lineSpacing;
    elements.letterSpacingRange.value = settings.letterSpacing;
    elements.letterSpacingValue.value = `${settings.letterSpacing}px`;
    elements.readingThemeSelect.value = settings.theme;
    elements.readingRulerToggle.checked = settings.readingRuler;
    elements.readingRuler.classList.toggle("active", settings.readingRuler);

    content.style.setProperty(
      "--reading-font-size",
      `${settings.fontSize}px`
    );
  }

  function updateFontSize(amount) {
    settings.fontSize = Math.min(
      30,
      Math.max(15, settings.fontSize + amount)
    );
    applySettings();
  }


  // --------------------------------------------------
  // ACCESSIBILITY PANEL
  // --------------------------------------------------

  function openAccessibilityPanel() {
    elements.accessibilityPanel.classList.remove("hidden");
    elements.accessibilityButton.setAttribute("aria-expanded", "true");
  }

  function closeAccessibilityPanel() {
    elements.accessibilityPanel.classList.add("hidden");
    elements.accessibilityButton.setAttribute("aria-expanded", "false");
  }

  function toggleAccessibilityPanel() {
    const isOpen =
      !elements.accessibilityPanel.classList.contains("hidden");
    if (isOpen) {
      closeAccessibilityPanel();
    } else {
      openAccessibilityPanel();
    }
  }


  // --------------------------------------------------
  // FOCUS MODE
  // --------------------------------------------------

  function toggleFocusMode() {
    focusMode = !focusMode;

    document.body.classList.toggle("focus-mode", focusMode);

    elements.focusModeButton.setAttribute(
      "aria-pressed",
      String(focusMode)
    );

    const label = elements.focusModeButton.querySelector("span");

    if (label) {
      setText(label, focusMode ? "Exit focus mode" : "Focus mode");
    }

    if (focusMode) {
      closeAccessibilityPanel();
      annotationTools.closePanel();
    }
  }

  function exitFocusMode() {
    if (!focusMode) return;
    focusMode = false;
    document.body.classList.remove("focus-mode");
    elements.focusModeButton.setAttribute("aria-pressed", "false");
    const label = elements.focusModeButton.querySelector("span");
    if (label) setText(label, "Focus mode");
  }


  // --------------------------------------------------
  // FLASHCARD GENERATION
  // --------------------------------------------------

  function createDocumentId(title, content) {
    const text = `${title || ""}\n${content || ""}`;
    let hashA = 0x811c9dc5;
    let hashB = 0x45d9f3b;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ code, 0x45d9f3b);
    }

    const first = (hashA >>> 0).toString(16).padStart(8, "0");
    const second = (hashB >>> 0).toString(16).padStart(8, "0");

    return `document-${first}${second}`;
  }

  function createFlashcardsFromDocument() {
    if (!currentDocument) return;

    setGenerationStatus("Finding useful learning concepts...");
    elements.generateFlashcardsButton.disabled = true;

    try {
      const sentences = segmentText(currentDocument.content);
      const terms = extractTerms(currentDocument.content);
      const scoredSentences = scoreSentences(sentences, terms);
      const generatedCards = generateFlashcards(scoredSentences, terms);

      if (!generatedCards.length) {
        setGenerationStatus(
          "We couldn't create suitable flashcards from this material. Try a longer lesson with more complete sentences."
        );
        return;
      }

      const documentId = createDocumentId(
        currentDocument.title,
        currentDocument.content
      );

      const savedCards = addFlashcards(
        generatedCards.map(card => ({
          ...card,
          documentId,
          documentTitle: currentDocument.title
        }))
      );

      updateRevisionCount();

      setGenerationStatus(
        `${savedCards.length} flashcards added to your revision collection.`
      );

    } catch (error) {
      console.error("Flashcard generation failed:", error);
      setGenerationStatus(
        "Something went wrong while creating flashcards. Please try again."
      );
    } finally {
      elements.generateFlashcardsButton.disabled = false;
    }
  }


  // --------------------------------------------------
  // READING RULER
  // --------------------------------------------------

  function updateRulerPosition(event) {
    if (!settings.readingRuler) return;

    const rulerHeight = 40;

    const top = Math.max(
      0,
      Math.min(
        window.innerHeight - rulerHeight,
        event.clientY - rulerHeight / 2
      )
    );

    elements.readingRuler.style.top = `${top}px`;
  }


  // --------------------------------------------------
  // RESET SETTINGS
  // --------------------------------------------------

  function resetSettings() {
    settings = { ...DEFAULT_SETTINGS };
    applySettings();
  }


  // --------------------------------------------------
  // SPEECH PLAYBACK
  // --------------------------------------------------

  function startSpeech() {
    if (!currentDocument) return;
    speech.speak(currentDocument.content);
  }


  // --------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------

  elements.documentContent.addEventListener("input", updateWordCount);

  elements.startReadingButton.addEventListener("click", async () => {
    await openReader(
      elements.documentTitle.value,
      elements.documentContent.value
    );
  });

  elements.sampleButton.addEventListener("click", async () => {
    elements.documentTitle.value = SAMPLE_DOCUMENT.title;
    elements.documentContent.value = SAMPLE_DOCUMENT.content;

    updateWordCount();
    showMessage("");

    await openReader(SAMPLE_DOCUMENT.title, SAMPLE_DOCUMENT.content);
  });

  elements.fileInput.addEventListener("change", event => {
    processFile(event.target.files?.[0]);
  });

  initializeDropzone();

  elements.editDocumentButton.addEventListener("click", returnToEditor);

  elements.increaseFontButton.addEventListener("click", () => updateFontSize(1));
  elements.decreaseFontButton.addEventListener("click", () => updateFontSize(-1));

  elements.accessibilityButton.addEventListener("click", toggleAccessibilityPanel);
  elements.closeAccessibilityButton.addEventListener("click", closeAccessibilityPanel);

  elements.fontFamilySelect.addEventListener("change", event => {
    settings.fontFamily = event.target.value;
    applySettings();
  });

  elements.lineSpacingRange.addEventListener("input", event => {
    settings.lineSpacing = Number(event.target.value);
    applySettings();
  });

  elements.letterSpacingRange.addEventListener("input", event => {
    settings.letterSpacing = Number(event.target.value);
    applySettings();
  });

  elements.readingThemeSelect.addEventListener("change", event => {
    settings.theme = event.target.value;
    applySettings();
  });

  elements.readingRulerToggle.addEventListener("change", event => {
    settings.readingRuler = event.target.checked;
    applySettings();
  });

  elements.resetReadingSettings.addEventListener("click", resetSettings);

  elements.readingContent.addEventListener("pointermove", updateRulerPosition);

  elements.readingContent.addEventListener("pointerleave", () => {
    if (settings.readingRuler) {
      elements.readingRuler.style.top = "-100px";
    }
  });

  elements.speechPlayButton.addEventListener("click", () => {
    if (speech.isPlaying && !speech.isPaused) {
      speech.pause();
    } else if (speech.isPaused) {
      speech.resume();
    } else {
      startSpeech();
    }
  });

  elements.focusModeButton.addEventListener("click", toggleFocusMode);

  elements.annotationsButton.addEventListener("click", annotationTools.openPanel);

  elements.sidebarAnnotationsButton.addEventListener("click", () => {
    closeMobileMenu();

    if (currentDocument) {
      navigateTo("reading");
      annotationTools.openPanel();
    } else {
      navigateTo("notes");
    }
  });

  elements.revisionNavButton.addEventListener("click", () => navigateTo("revision"));
  elements.sidebarReadingButton.addEventListener("click", () => navigateTo("reading"));

  elements.generateFlashcardsButton.addEventListener("click", createFlashcardsFromDocument);

  elements.mobileMenuButton.addEventListener("click", toggleMobileMenu);
  elements.mobileOverlay.addEventListener("click", closeMobileMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMobileMenu();
      closeAccessibilityPanel();
      annotationTools.closePanel();

      if (focusMode) toggleFocusMode();
    }
  });


  // --------------------------------------------------
  // BROWSER BACK / FORWARD
  // --------------------------------------------------

  window.addEventListener("popstate", () => {
    const route = parseRoute();

    if (route.page === "reading") {
      if (route.view === "reader" && currentDocument) {
        currentView = "reader";
      } else if (route.view === "reader" && !currentDocument) {
        currentView = "editor";
        window.history.replaceState(
          { app: "readease", page: "reading", view: "editor" },
          "",
          "#/reading/editor"
        );
      } else {
        currentView = "editor";
      }
    }

    navigateTo(route.page, { history: false });
  });


  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  window.addEventListener("beforeunload", () => speech.stop());


  // --------------------------------------------------
  // BOOT
  // --------------------------------------------------

  updateWordCount();
  applySettings();
  updateRevisionCount();

  // Restore a document from this browser session, if one exists.
  const restoredDocument = loadDocumentFromSession();
  if (restoredDocument) {
    currentDocument = restoredDocument;
    elements.documentTitle.value = restoredDocument.title;
    elements.documentContent.value = restoredDocument.content;
    updateWordCount();
  }

  // Decide initial view from URL + stored document.
  const initialRoute = parseRoute();

  if (initialRoute.page === "reading") {
    if (initialRoute.view === "reader" && currentDocument) {
      currentView = "reader";

      setText(elements.readingTitle, currentDocument.title);
      setText(
        elements.readingWordCount,
        `${getWordCount(currentDocument.content).toLocaleString()} words`
      );

      renderReadingContent(currentDocument.content);
      applySettings();

      annotationTools.open().catch(error => {
        console.warn("Annotations could not load at boot:", error);
      });

    } else if (initialRoute.view === "reader" && !currentDocument) {
      // Reader requested but no document — fall back to editor.
      currentView = "editor";
      window.history.replaceState(
        { app: "readease", page: "reading", view: "editor" },
        "",
        "#/reading/editor"
      );
    } else {
      currentView = "editor";
    }
  } else {
    // On revision / notes: keep reader state in memory if a document exists.
    currentView = currentDocument ? "reader" : "editor";
  }

  navigateTo(initialRoute.page, { history: false });

}


// ==========================================
// CUSTOM SCREENSHOT BRIDGE (For Viewport Simulator)
// ==========================================
window.addEventListener("message", (event) => {
  // Listen for the simulator's request
  if (event.data === "READEASE_CAPTURE_REQUEST") {
    
    // Clone the document to avoid mutating the actual page
    const clone = document.documentElement.cloneNode(true);
    
    // Remove scripts to prevent double-execution in the hidden iframe
    clone.querySelectorAll('script').forEach(s => s.remove());
    
    // Get all current CSS links (make them absolute so they work in the simulator)
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => link.href);
      
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map(style => style.innerHTML);

    // Send the exact current HTML and Styles back
    event.source.postMessage({
      type: "READEASE_CAPTURE_RESPONSE",
      html: clone.outerHTML,
      externalStyles: styles,
      inlineStyles: inlineStyles
    }, "*");
  }
});