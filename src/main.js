import { initializeApp } from "./app.js";


document.addEventListener("DOMContentLoaded", () => {
  
  try {
    
    initializeApp();
    
  } catch (error) {
    
    console.error("ReadEase initialization failed:", error);
    
    document.body.textContent =
      "ReadEase couldn't start. Please refresh the page.";
    
  }
  
});