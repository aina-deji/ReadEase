const MAX_CHUNK_LENGTH = 180;

export class SpeechService {
  
  constructor() {
    this.synthesis = window.speechSynthesis;
    
    this.currentIndex = 0;
    this.chunks = [];
    this.isPlaying = false;
    this.isPaused = false;
    
    this.onStateChange = () => {};
    this.onEnd = () => {};
    this.onError = () => {};
    
    this.selectedVoice = null;
    this.rate = 1;
    this.pitch = 1;
  }
  
  get supported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window
    );
  }
  
  splitText(text) {
    
    const sentences = text
      .replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [];
    
    const chunks = [];
    let currentChunk = "";
    
    for (const sentence of sentences) {
      
      const cleanSentence = sentence.trim();
      
      if (!cleanSentence) continue;
      
      if (
        currentChunk &&
        (currentChunk.length + cleanSentence.length + 1 > MAX_CHUNK_LENGTH)
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      if (cleanSentence.length > MAX_CHUNK_LENGTH) {
        
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        
        const words = cleanSentence.split(/\s+/);
        let segment = "";
        
        for (const word of words) {
          
          if (
            segment &&
            segment.length + word.length + 1 > MAX_CHUNK_LENGTH
          ) {
            chunks.push(segment.trim());
            segment = "";
          }
          
          segment += `${word} `;
          
        }
        
        if (segment.trim()) {
          chunks.push(segment.trim());
        }
        
        continue;
      }
      
      currentChunk += `${cleanSentence} `;
      
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  getVoices() {
    
    if (!this.supported) {
      return [];
    }
    
    return this.synthesis.getVoices();
  }
  
  setVoice(voiceURI) {
    
    const voice = this.getVoices().find(
      item => item.voiceURI === voiceURI
    );
    
    this.selectedVoice = voice || null;
  }
  
  setRate(rate) {
    
    this.rate = Math.min(2, Math.max(0.5, Number(rate)));
  }
  
  setPitch(pitch) {
    
    this.pitch = Math.min(2, Math.max(0.5, Number(pitch)));
  }
  
  speak(text) {
    
    if (!this.supported) {
      this.onError("Speech is not supported by this browser.");
      return;
    }
    
    const cleanText = String(text || "").trim();
    
    if (!cleanText) {
      this.onError("There is no text available to read.");
      return;
    }
    
    this.stop();
    
    this.chunks = this.splitText(cleanText);
    this.currentIndex = 0;
    
    if (!this.chunks.length) {
      this.onError("There is no readable text.");
      return;
    }
    
    this.isPlaying = true;
    this.isPaused = false;
    
    this.onStateChange("playing");
    
    this.speakNext();
  }
  
  speakNext() {
    
    if (!this.isPlaying) return;
    
    if (this.currentIndex >= this.chunks.length) {
      
      this.isPlaying = false;
      this.isPaused = false;
      
      this.onStateChange("ended");
      this.onEnd();
      
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(
      this.chunks[this.currentIndex]
    );
    
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    
    utterance.onend = () => {
      
      if (!this.isPlaying || this.isPaused) return;
      
      this.currentIndex += 1;
      
      this.speakNext();
      
    };
    
    utterance.onerror = event => {
      
      if (event.error === "canceled" || event.error === "interrupted") {
        return;
      }
      
      this.isPlaying = false;
      this.isPaused = false;
      
      this.onStateChange("error");
      this.onError("Speech playback encountered an error.");
      
    };
    
    this.synthesis.speak(utterance);
  }
  
  pause() {
    
    if (!this.supported || !this.isPlaying || this.isPaused) {
      return;
    }
    
    this.synthesis.pause();
    
    this.isPaused = true;
    
    this.onStateChange("paused");
  }
  
  resume() {
    
    if (!this.supported || !this.isPaused) {
      return;
    }
    
    this.synthesis.resume();
    
    this.isPaused = false;
    this.isPlaying = true;
    
    this.onStateChange("playing");
  }
  
  stop() {
    
    if (this.supported) {
      this.synthesis.cancel();
    }
    
    this.isPlaying = false;
    this.isPaused = false;
    
    this.currentIndex = 0;
    this.chunks = [];
    
    this.onStateChange("stopped");
  }
  
}