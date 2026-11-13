export function getElement(selector, parent = document) {
  const element = parent.querySelector(selector);
  
  if (!element) {
    throw new Error(`Required DOM element not found: ${selector}`);
  }
  
  return element;
}


export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  
  return element;
}


export function setText(element, value) {
  element.textContent = String(value ?? "");
}