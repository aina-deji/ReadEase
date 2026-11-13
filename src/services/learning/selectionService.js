export class SelectionService {
  
  constructor(container) {
    this.container = container;
  }
  
  
  getParagraph(node) {
    
    const element = node.nodeType === Node.ELEMENT_NODE ?
      node :
      node.parentElement;
    
    const paragraph = element?.closest("p");
    
    if (!paragraph || !this.container.contains(paragraph)) {
      return null;
    }
    
    return paragraph;
    
  }
  
  
  getPositionWithinParagraph(paragraph, node, offset) {
    
    const range = document.createRange();
    
    range.selectNodeContents(paragraph);
    
    try {
      
      range.setEnd(node, offset);
      
      return range.toString().length;
      
    } catch {
      
      return null;
      
    }
    
  }
  
  
  getSelection() {
    
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed) {
      return null;
    }
    
    const selectedText = selection.toString();
    
    if (!selectedText.trim()) {
      return null;
    }
    
    const startParagraph = this.getParagraph(
      selection.anchorNode
    );
    
    const endParagraph = this.getParagraph(
      selection.focusNode
    );
    
    if (!startParagraph || !endParagraph) {
      return null;
    }
    
    const startParagraphOffset = Number(
      startParagraph.dataset.start
    );
    
    const endParagraphOffset = Number(
      endParagraph.dataset.start
    );
    
    if (
      !Number.isInteger(startParagraphOffset) ||
      !Number.isInteger(endParagraphOffset)
    ) {
      return null;
    }
    
    const anchorOffset = this.getPositionWithinParagraph(
      startParagraph,
      selection.anchorNode,
      selection.anchorOffset
    );
    
    const focusOffset = this.getPositionWithinParagraph(
      endParagraph,
      selection.focusNode,
      selection.focusOffset
    );
    
    if (anchorOffset === null || focusOffset === null) {
      return null;
    }
    
    let start = startParagraphOffset + anchorOffset;
    
    let end = endParagraphOffset + focusOffset;
    
    if (start > end) {
      [start, end] = [end, start];
    }
    
    return {
      
      text: selectedText,
      
      start,
      
      end
      
    };
    
  }
  
  
  clearSelection() {
    
    window.getSelection()?.removeAllRanges();
    
  }
  
}