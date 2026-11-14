# ReadEase - Read. Understand. Remember.

**Making learning materials easier to read, understand, and remember.**

ReadEase is an accessibility-focused learning workspace designed to help
students interact with educational content in ways that better support
their individual reading and learning needs.

> Reading should not be a barrier to learning.

Yet for many students, dense text, difficult layouts, reading fatigue,
and limited accessibility options can make studying unnecessarily
difficult.

ReadEase aims to change that by bringing accessible reading tools and
practical learning features together in one workspace.

## The Problem

Educational content is not always accessible to the people who need it.

Students may struggle with:

-   Dense paragraphs and overwhelming blocks of text.
-   Reading fatigue and difficulty maintaining focus.
-   Finding comfortable reading settings.
-   Understanding and retaining important information.
-   Revising material effectively after reading.
-   Accessing useful learning tools without expensive subscriptions.

When students spend more energy struggling with how information is
presented, they have less energy available for actually learning it.

The problem isn't always the student's ability to learn. Sometimes, it's
the way learning material is presented.

## Our Solution

ReadEase provides a student-friendly environment where learners can
import or paste educational material, adjust their reading experience,
interact with important information, and practise what they've learned.

Instead of treating accessibility as an afterthought, ReadEase makes it
part of the learning experience.

## Key Features

### 1. Accessible Reading Workspace

-   Import or paste learning materials.
-   Read content in a dedicated reading environment.
-   Use comfortable reading layouts and typography.
-   Adjust accessibility preferences to support individual needs.

### 2. Personalised Reading Experience

-   Customisable reading appearance.
-   Reading ruler to help maintain visual focus.
-   Focus mode to reduce distractions.
-   Accessibility controls designed to make reading more comfortable.

### 3. Text-to-Speech

-   Listen to educational content using speech playback.
-   Support learners who benefit from auditory presentation.
-   Make it easier to engage with reading material in different ways.

### 4. Notes and Annotations

-   Interact with important parts of a document.
-   Highlight useful information.
-   Create notes to support understanding and revision.

### 5. Flashcards and Revision

-   Generate flashcards from learning materials.
-   Organise revision content into collections.
-   Practise flashcards even when they are not due for review.
-   Use spaced repetition to support ongoing revision.

### 6. Learning and Retention Tools

ReadEase goes beyond displaying text. It also provides tools that
encourage students to revisit information and strengthen their
understanding over time.

## What Makes ReadEase Different?

ReadEase is built around a simple idea:

> **Accessibility should help students participate in learning, not make
> them work harder to access it.**

Many reading tools focus on changing how text looks. ReadEase brings
together reading accessibility and active learning features.

  Traditional reading experience   ReadEase
  -------------------------------- ------------------------------------
  Fixed reading presentation       Adjustable reading experience
  Long blocks of text              Focus-supporting reading tools
  Reading only                     Reading and text-to-speech
  Passive consumption              Highlights, notes, and annotations
  Separate revision process        Integrated flashcards and practice

Our goal is not to replace teachers, textbooks, or existing learning
platforms. It is to make the learning materials students already use
more approachable.

## Built With

ReadEase is developed using web technologies, with a focus on a
lightweight and accessible experience.

-   HTML5
-   CSS3
-   JavaScript
-   Browser speech capabilities
-   Custom learning and revision algorithms

The project uses practical, purpose-built logic rather than requiring a
paid AI API for its core learning functionality.

## Getting Started
live URL [https://aina-deji.github.io/ReadEase](https://aina-deji.github.io/ReadEase)

### 1. Clone the repository

``` bash
git clone https://github.com/aina-deji/ReadEase.git
```



### 2. Enter the project directory

``` bash
cd readease
```

### 3. Run the application

If the project uses native JavaScript modules, serve it through a local
web server.

For example:

``` bash
python -m http.server 8000
```

### 4. Open ReadEase

Visit <http://localhost:8000>.

You can also use the VS Code Live Server extension.

## Project Structure

The application is organised into separate areas for its interface,
learning logic, and supporting services.

``` text
ReadEase/
├── README.md
├── index.html
├── public/
│   └── favicon.svg
└── src/
    ├── algorithms/
    │   ├── clozeGenerator.js
    │   ├── sentenceScorer.js
    │   ├── spacedRepetition.js
    │   ├── termExtractor.js
    │   └── textSegmenter.js
    ├── app.js
    ├── core/
    │   └── dom.js
    ├── main.js
    ├── services/
    │   ├── learning/
    │   │   ├── annotationService.js
    │   │   ├── revisionService.js
    │   │   └── selectionService.js
    │   ├── speech/
    │   │   └── speechService.js
    │   └── storage/
    │       └── database.js
    ├── styles/
    │   ├── accessibility.css
    │   ├── base.css
    │   ├── components.css
    │   ├── layout.css
    │   ├── polish.css
    │   ├── responsive.css
    │   └── tokens.css
    └── ui/
        ├── annotations.js
        └── flashcards.js
```

## Accessibility and Inclusion

Accessibility is central to ReadEase's design philosophy.

The project aims to support different learning preferences by offering:

-   More comfortable reading presentation.
-   Visual focus assistance.
-   Auditory access through text-to-speech.
-   Reduced-distraction reading.
-   Multiple ways to interact with learning content.

No single interface works perfectly for every learner. ReadEase aims to
give students more control over their reading experience.

## Who Is ReadEase For?

ReadEase is designed with students and independent learners in mind,
particularly those who:

-   Find traditional reading layouts difficult or tiring.
-   Prefer listening alongside reading.
-   Need help maintaining focus.
-   Want a more structured approach to revision.
-   Benefit from accessible learning environments.

## Current Limitations

ReadEase is an evolving project, and transparency matters.

-   Text-to-speech availability and voice quality depend on browser and
    device support.
-   Some document formats or document layouts may not import perfectly.
-   Accessibility preferences cannot guarantee that every individual
    need is met.
-   The project is a prototype and requires further testing with
    students with different accessibility needs.
-   It is not a replacement for professional educational or
    accessibility support.

## Future Improvements

Potential areas for development include:

-   More comprehensive accessibility testing with students.
-   Improved document-format support.
-   Additional reading customisation.
-   More flexible revision strategies.
-   Better progress tracking.
-   Further improvements to keyboard navigation and assistive technology
    compatibility.

## Built for AccessED Hacks 2026

ReadEase was created for AccessED Hacks 2026, with a focus on reducing
barriers to learning.

Our challenge was to explore how technology could make educational
experiences more inclusive, approachable, and useful.

We chose to focus on an everyday barrier that can easily be overlooked:
the difficulty of accessing and engaging with learning material.

We believe students should have more opportunities to learn in ways that
work for them.

**ReadEase --- Read. Understand. Remember.**

## A Final Thought

Learning is not one-size-fits-all.

Some students learn by reading. Others benefit from listening, visual
guidance, repetition, or a combination of different approaches.

ReadEase is built on the belief that students deserve tools that
recognise those differences.

Because access to education should not depend on how easily someone can
read a page.
