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


export function initializeApp() {

  const elements = {

    sidebar: getElement("#sidebar"),
    mobileMenuButton: getElement("#mobileMenuButton"),
    mobileOverlay: getElement("#mobileOverlay"),

    documentTitle: getElement("#documentTitle"),
    documentContent: getElement("#documentContent"),
    fileInput: getElement("#fileInput"),

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
    sidebarAnnotationsButton: getElement("#sidebarAnnotationsButton")

  };


  let settings = { ...DEFAULT_SETTINGS };

  let focusMode = false;

  let currentDocument = null;

  const speech = new SpeechService();


  // ANNOTATION SYSTEM

  const annotationTools = initializeAnnotations({
    readingContent: elements.readingContent,
    getDocument: () => currentDocument
  });


  // WORD COUNT

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


  // SPEECH

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


  // READING CONTENT

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


  // OPEN READER

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

    applySettings();

    // Load saved annotations for this document.
    await annotationTools.open();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  // RETURN TO EDITOR

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

    elements.documentTitle.focus();

  }


  // ACCESSIBILITY SETTINGS

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


  // ACCESSIBILITY PANEL

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


  // FOCUS MODE

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


  // MOBILE NAVIGATION

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


  // READING RULER

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


  // RESET SETTINGS

  function resetSettings() {

    settings = { ...DEFAULT_SETTINGS };

    applySettings();

  }


  // SPEECH PLAYBACK

  function startSpeech() {

    if (!currentDocument) return;

    speech.speak(currentDocument.content);

  }


  // EVENT LISTENERS

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


  // FILE UPLOAD

  elements.fileInput.addEventListener(
    "change",
    async event => {

      const file = event.target.files?.[0];

      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".txt")) {

        showMessage("Please select a .txt file.");

        return;

      }

      try {

        const content = await file.text();

        elements.documentTitle.value =
          file.name.replace(/\.txt$/i, "");

        elements.documentContent.value = content;

        updateWordCount();

        showMessage("");

      } catch {

        showMessage(
          "We couldn't read that file. Please try another one."
        );

      }

      elements.fileInput.value = "";

    }
  );


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


  // READING RULER EVENTS

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


  // SPEECH EVENTS

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
        annotationTools.openPanel();
      } else {
        showMessage("Open a reading document to view your annotations.");
      }

    }
  );


  // MOBILE NAVIGATION

  elements.mobileMenuButton.addEventListener(
    "click",
    toggleMobileMenu
  );


  elements.mobileOverlay.addEventListener(
    "click",
    closeMobileMenu
  );


  // KEYBOARD SHORTCUTS

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


  // INITIALIZE

  updateWordCount();

  applySettings();

}