const state = {
  
  currentDocument: null,
  
  documents: [],
  
  settings: {
    fontFamily: "serif",
    fontSize: 19,
    lineSpacing: 1.9,
    letterSpacing: 0,
    theme: "light",
    readingRuler: false
  },
  
  annotations: [],
  
  searchQuery: "",
  
  focusMode: false
  
};


const listeners = new Map();


export function getState(key) {
  
  return state[key];
  
}


export function setState(key, value) {
  
  state[key] = value;
  
  const callbacks = listeners.get(key) || [];
  
  callbacks.forEach(callback => callback(value));
  
}


export function subscribe(key, callback) {
  
  if (!listeners.has(key)) {
    listeners.set(key, []);
  }
  
  listeners.get(key).push(callback);
  
  return () => {
    
    const callbacks = listeners.get(key) || [];
    
    listeners.set(
      key,
      callbacks.filter(item => item !== callback)
    );
    
  };
  
}


export function getAllState() {
  
  return { ...state };
  
}