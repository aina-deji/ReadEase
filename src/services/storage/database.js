const STORAGE_PREFIX = "readease:";

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export const database = {
  
  async get(key, fallback = null) {
    
    try {
      
      const value = localStorage.getItem(
        getStorageKey(key)
      );
      
      return value === null ?
        fallback :
        JSON.parse(value);
      
    } catch (error) {
      
      console.error("Storage read failed:", error);
      
      return fallback;
      
    }
    
  },
  
  
  async set(key, value) {
    
    try {
      
      localStorage.setItem(
        getStorageKey(key),
        JSON.stringify(value)
      );
      
      return true;
      
    } catch (error) {
      
      console.error("Storage save failed:", error);
      
      return false;
      
    }
    
  },
  
  
  async remove(key) {
    
    try {
      
      localStorage.removeItem(
        getStorageKey(key)
      );
      
      return true;
      
    } catch (error) {
      
      console.error("Storage removal failed:", error);
      
      return false;
      
    }
    
  },
  
  
  async clear() {
    
    try {
      
      Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
      
      return true;
      
    } catch (error) {
      
      console.error("Storage clearing failed:", error);
      
      return false;
      
    }
    
  }
  
};