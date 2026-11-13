/**
 * ReadEase Text Segmenter
 *
 * Responsibilities:
 * - Normalize imported text.
 * - Identify paragraphs.
 * - Split paragraphs into sentences.
 * - Preserve paragraph and sentence positions.
 */

const MIN_SENTENCE_LENGTH = 3;

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitIntoSentences(text) {
  if (!text) return [];
  
  // Preferred sentence segmentation.
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", {
      granularity: "sentence"
    });
    
    return Array.from(
      segmenter.segment(text),
      item => item.segment.trim()
    ).filter(Boolean);
  }
  
  // Fallback for browsers without Intl.Segmenter.
  return (
      text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || []
    )
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function countWords(text) {
  return (
    text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []
  ).length;
}

/**
 * Segment reading material.
 *
 * @param {string} text
 * @returns {Array}
 */
export function segmentText(text) {
  const normalizedText = normalizeText(text);
  
  if (!normalizedText) return [];
  
  const paragraphs = normalizedText
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  
  const results = [];
  
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const sentences = splitIntoSentences(paragraph);
    
    sentences.forEach((sentence, sentenceIndex) => {
      const wordCount = countWords(sentence);
      
      if (wordCount < MIN_SENTENCE_LENGTH) return;
      
      results.push({
        id: `p${paragraphIndex}-s${sentenceIndex}`,
        text: sentence,
        paragraphIndex,
        sentenceIndex,
        wordCount
      });
    });
  });
  
  return results;
}