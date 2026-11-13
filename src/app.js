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
    speechPauseButton: getElement("#speechPauseButton"),
    speechStopButton: getElement("#speechStopButton"),
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


  let settings = { ...DEFAULT_SETTINGS };

  let focusMode = false;

  let currentDocument = null;

  let activePage = "reading";

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

    const count = getWordCount(
      elements.documentContent.value
    );

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
  // PAGE NAVIGATION
  // --------------------------------------------------

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


  function navigateTo(page) {

    activePage = page;

    elements.readingPage.classList.toggle(
      "hidden",
      page !== "reading"
    );

    elements.revisionPage.classList.toggle(
      "hidden",
      page !== "revision"
    );

    elements.notesPage.classList.toggle(
      "hidden",
      page !== "notes"
    );

    const pageNames = {
      reading: currentDocument?.title || "My reading",
      revision: "Revision",
      notes: "My notes"
    };

    setText(
      elements.breadcrumbCurrent,
      pageNames[page] || "Workspace"
    );

    updateNavigationButtons();

    closeMobileMenu();

    if (page === "revision") {
      refreshRevisionDashboard();
    }

    if (page === "notes") {
      renderNotesPage();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

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

    setText(
      elements.revisionNavCount,
      String(stats.dueCards)
    );

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
  // SPEECH
  // --------------------------------------------------

  function setSpeechStatus(message) {

    setText(elements.speechStatus, message);

  }


  function updateSpeechControls(state) {

    const playing = state === "playing";
    const paused = state === "paused";

    elements.speechPlayButton.disabled =
      !speech.supported || playing;

    elements.speechPauseButton.disabled =
      !playing;

    elements.speechStopButton.disabled =
      !playing && !paused;

    if (state === "playing") {
      setSpeechStatus("Reading aloud...");
    }

    if (state === "paused") {
      setSpeechStatus("Playback paused");
    }

    if (state === "stopped") {
      setSpeechStatus("Ready when you are");
    }

    if (state === "ended") {
      setSpeechStatus("Finished reading");
    }

    if (state === "error") {
      setSpeechStatus("Unable to continue playback");
    }

  }


  speech.onStateChange = updateSpeechControls;

  speech.onError = message => {

    setSpeechStatus(message);

    updateSpeechControls("error");

  };


  if (!speech.supported) {

    elements.speechPlayButton.disabled = true;

    setSpeechStatus(
      "Text-to-speech is not supported in this browser."
    );

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

      const paragraphElement = createElement("p", {
        text: paragraph
      });

      elements.readingContent.appendChild(paragraphElement);

    }

  }


  // --------------------------------------------------
  // OPEN READER
  // --------------------------------------------------

  async function openReader(title, content) {

    const cleanTitle = title.trim() || "Untitled reading";

    const cleanContent = content.trim();

    if (!cleanContent) {

      showMessage(
        "Please add some reading material before continuing."
      );

      return;

    }

    currentDocument = {
      title: cleanTitle,
      content: cleanContent
    };

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

    await annotationTools.open();

    navigateTo("reading");

  }


  // --------------------------------------------------
  // RETURN TO IMPORT
  // --------------------------------------------------

  function returnToEditor() {

    speech.stop();

    annotationTools.closePanel();

    if (focusMode) {
      toggleFocusMode();
    }

    closeAccessibilityPanel();

    elements.readerSection.classList.add("hidden");

    elements.importSection.classList.remove("hidden");

    elements.pageHeading.classList.remove("hidden");

    setText(elements.breadcrumbCurrent, "My reading");

    document.title = "ReadEase — Read. Understand. Remember.";

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

          pdfjs.GlobalWorkerOptions.workerSrc =
            PDFJS_WORKER_URL;

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
  
  if (window.mammoth) {
    return window.mammoth;
  }
  
  if (!mammothPromise) {
    
    mammothPromise = new Promise((resolve, reject) => {
      
      const script = document.createElement("script");
      
      script.src = MAMMOTH_SCRIPT_URL;
      script.async = true;
      
      script.onload = () => {
        
        if (window.mammoth) {
          resolve(window.mammoth);
        } else {
          reject(
            new Error("The Word document reader could not initialize.")
          );
        }
        
      };
      
      script.onerror = () => {
        reject(
          new Error("The Word document reader could not load. Check your internet connection.")
        );
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
    
    const result = await mammoth.extractRawText({
      arrayBuffer
    });
    
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
      typeof item.str === "string" &&
      item.str.trim().length > 0
    );

    if (!items.length) return "";

    const lines = [];

    let currentLine = "";

    let previousY = null;

    let previousEndX = null;

    function finishLine() {

      const cleaned = currentLine.trim();

      if (cleaned) {
        lines.push(cleaned);
      }

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

        // Larger vertical gaps usually indicate
        // separate paragraphs or sections.

        if (verticalGap > 16) {
          lines.push("");
        }

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

      if (
        typeof x === "number" &&
        typeof item.width === "number"
      ) {

        previousEndX = x + item.width;

      }

      if (typeof y === "number") {
        previousY = y;
      }

      if (item.hasEOL) {
        finishLine();
      }

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

      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer)
      });

      pdf = await loadingTask.promise;

      let extractedPages = [];

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {

        setUploadStatus(
          `Extracting PDF text: page ${pageNumber} of ${pdf.numPages}...`
        );

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = extractPageText(textContent);

        if (pageText) {
          extractedPages.push(pageText);
        }

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

        try {
          await pdf.destroy();
        } catch (error) {
          console.warn("Could not close PDF document:", error);
        }

      } else if (loadingTask) {

        try {
          await loadingTask.destroy();
        } catch (error) {
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

        // Remove a possible UTF-8 byte-order mark.

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

        throw new Error(
          "No readable text was found in this file."
        );

      }


      // Only update the editor after successful extraction.
      // This protects existing text if an upload fails.

      const cleanTitle = file.name.replace(/\.[^.]+$/, "");

      elements.documentTitle.value = cleanTitle;

      elements.documentContent.value = content.trim();

      updateWordCount();

      setUploadStatus(
        `Ready: ${file.name}`
      );

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

      // Allow the same file to be selected again.

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

      if (file) {
        processFile(file);
      }

    });

  }


  // --------------------------------------------------
  // ACCESSIBILITY SETTINGS
  // --------------------------------------------------

  function applySettings() {

    const content = elements.readingContent;

    content.style.fontFamily =
      FONT_FAMILIES[settings.fontFamily];

    content.style.fontSize =
      `${settings.fontSize}px`;

    content.style.lineHeight =
      settings.lineSpacing;

    content.style.letterSpacing =
      `${settings.letterSpacing}px`;

    elements.readingCard.dataset.theme =
      settings.theme;

    elements.fontFamilySelect.value =
      settings.fontFamily;

    elements.lineSpacingRange.value =
      settings.lineSpacing;

    elements.lineSpacingValue.value =
      settings.lineSpacing;

    elements.letterSpacingRange.value =
      settings.letterSpacing;

    elements.letterSpacingValue.value =
      `${settings.letterSpacing}px`;

    elements.readingThemeSelect.value =
      settings.theme;

    elements.readingRulerToggle.checked =
      settings.readingRuler;

    elements.readingRuler.classList.toggle(
      "active",
      settings.readingRuler
    );

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

    elements.accessibilityButton.setAttribute(
      "aria-expanded",
      "true"
    );

  }


  function closeAccessibilityPanel() {

    elements.accessibilityPanel.classList.add("hidden");

    elements.accessibilityButton.setAttribute(
      "aria-expanded",
      "false"
    );

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

    document.body.classList.toggle(
      "focus-mode",
      focusMode
    );

    elements.focusModeButton.setAttribute(
      "aria-pressed",
      String(focusMode)
    );

    const label = elements.focusModeButton.querySelector("span");

    if (label) {

      setText(
        label,
        focusMode ? "Exit focus mode" : "Focus mode"
      );

    }

    if (focusMode) {

      closeAccessibilityPanel();

      annotationTools.closePanel();

    }

  }


  // --------------------------------------------------
  // FLASHCARD GENERATION
  // --------------------------------------------------

  function createFlashcardsFromDocument() {

    if (!currentDocument) return;

    setGenerationStatus(
      "Finding useful learning concepts..."
    );

    elements.generateFlashcardsButton.disabled = true;

    try {

      const sentences = segmentText(
        currentDocument.content
      );

      const terms = extractTerms(
        currentDocument.content
      );

      const scoredSentences = scoreSentences(
        sentences,
        terms
      );

      const generatedCards = generateFlashcards(
        scoredSentences,
        terms
      );

      if (!generatedCards.length) {

        setGenerationStatus(
          "We couldn't create suitable flashcards from this material. Try a longer lesson with more complete sentences."
        );

        return;

      }

      const savedCards = addFlashcards(
        generatedCards.map(card => ({
          ...card,
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
  // MOBILE NAVIGATION
  // --------------------------------------------------

  function closeMobileMenu() {

    elements.sidebar.classList.remove("open");

    elements.mobileOverlay.classList.remove("visible");

    elements.mobileMenuButton.setAttribute(
      "aria-expanded",
      "false"
    );

  }


  function toggleMobileMenu() {

    const isOpen =
      elements.sidebar.classList.toggle("open");

    elements.mobileOverlay.classList.toggle(
      "visible",
      isOpen
    );

    elements.mobileMenuButton.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

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

  elements.documentContent.addEventListener(
    "input",
    updateWordCount
  );


  elements.startReadingButton.addEventListener(
    "click",
    async () => {

      await openReader(
        elements.documentTitle.value,
        elements.documentContent.value
      );

    }
  );


  elements.sampleButton.addEventListener(
    "click",
    async () => {

      elements.documentTitle.value =
        SAMPLE_DOCUMENT.title;

      elements.documentContent.value =
        SAMPLE_DOCUMENT.content;

      updateWordCount();

      showMessage("");

      await openReader(
        SAMPLE_DOCUMENT.title,
        SAMPLE_DOCUMENT.content
      );

    }
  );


  elements.fileInput.addEventListener(
    "change",
    event => {
      processFile(event.target.files?.[0]);
    }
  );


  initializeDropzone();


  elements.editDocumentButton.addEventListener(
    "click",
    returnToEditor
  );


  // FONT SIZE

  elements.increaseFontButton.addEventListener(
    "click",
    () => updateFontSize(1)
  );


  elements.decreaseFontButton.addEventListener(
    "click",
    () => updateFontSize(-1)
  );


  // ACCESSIBILITY PANEL

  elements.accessibilityButton.addEventListener(
    "click",
    toggleAccessibilityPanel
  );


  elements.closeAccessibilityButton.addEventListener(
    "click",
    closeAccessibilityPanel
  );


  elements.fontFamilySelect.addEventListener(
    "change",
    event => {

      settings.fontFamily = event.target.value;

      applySettings();

    }
  );


  elements.lineSpacingRange.addEventListener(
    "input",
    event => {

      settings.lineSpacing =
        Number(event.target.value);

      applySettings();

    }
  );


  elements.letterSpacingRange.addEventListener(
    "input",
    event => {

      settings.letterSpacing =
        Number(event.target.value);

      applySettings();

    }
  );


  elements.readingThemeSelect.addEventListener(
    "change",
    event => {

      settings.theme = event.target.value;

      applySettings();

    }
  );


  elements.readingRulerToggle.addEventListener(
    "change",
    event => {

      settings.readingRuler =
        event.target.checked;

      applySettings();

    }
  );


  elements.resetReadingSettings.addEventListener(
    "click",
    resetSettings
  );


  // RULER EVENTS

  elements.readingContent.addEventListener(
    "pointermove",
    updateRulerPosition
  );


  elements.readingContent.addEventListener(
    "pointerleave",
    () => {

      if (settings.readingRuler) {
        elements.readingRuler.style.top = "-100px";
      }

    }
  );


  // SPEECH

  elements.speechPlayButton.addEventListener(
    "click",
    () => {

      if (speech.isPaused) {
        speech.resume();
      } else {
        startSpeech();
      }

    }
  );


  elements.speechPauseButton.addEventListener(
    "click",
    () => speech.pause()
  );


  elements.speechStopButton.addEventListener(
    "click",
    () => speech.stop()
  );


  // FOCUS MODE

  elements.focusModeButton.addEventListener(
    "click",
    toggleFocusMode
  );


  // ANNOTATIONS

  elements.annotationsButton.addEventListener(
    "click",
    annotationTools.openPanel
  );


  elements.sidebarAnnotationsButton.addEventListener(
    "click",
    () => {

      closeMobileMenu();

      if (currentDocument) {

        navigateTo("reading");

        annotationTools.openPanel();

      } else {

        navigateTo("notes");

      }

    }
  );


  // REVISION

  elements.revisionNavButton.addEventListener(
    "click",
    () => navigateTo("revision")
  );


  // READING NAVIGATION

  elements.sidebarReadingButton.addEventListener(
    "click",
    () => navigateTo("reading")
  );


  elements.generateFlashcardsButton.addEventListener(
    "click",
    createFlashcardsFromDocument
  );


  // MOBILE

  elements.mobileMenuButton.addEventListener(
    "click",
    toggleMobileMenu
  );


  elements.mobileOverlay.addEventListener(
    "click",
    closeMobileMenu
  );


  // KEYBOARD

  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {

        closeMobileMenu();

        closeAccessibilityPanel();

        annotationTools.closePanel();

        if (focusMode) {
          toggleFocusMode();
        }

      }

    }
  );


  // CLEANUP

  window.addEventListener(
    "beforeunload",
    () => speech.stop()
  );


  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  updateWordCount();

  applySettings();

  updateRevisionCount();

  navigateTo("reading");

}