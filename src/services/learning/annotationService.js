import { database } from "../storage/database.js";

const STORAGE_KEY = "annotations";

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class AnnotationService {
  
  async getAll(documentId) {
    const annotations = await database.get(STORAGE_KEY, []);
    
    return annotations.filter(
      item => item.documentId === documentId
    );
  }
  
  async add(documentId, annotation) {
    const annotations = await database.get(STORAGE_KEY, []);
    
    const item = {
      id: createId(),
      documentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...annotation
    };
    
    annotations.push(item);
    
    const saved = await database.set(STORAGE_KEY, annotations);
    
    if (!saved) {
      throw new Error("Could not save annotation.");
    }
    
    return item;
  }
  
  async update(id, changes) {
    const annotations = await database.get(STORAGE_KEY, []);
    
    const index = annotations.findIndex(
      item => item.id === id
    );
    
    if (index === -1) {
      throw new Error("Annotation not found.");
    }
    
    annotations[index] = {
      ...annotations[index],
      ...changes,
      updatedAt: new Date().toISOString()
    };
    
    const saved = await database.set(STORAGE_KEY, annotations);
    
    if (!saved) {
      throw new Error("Could not update annotation.");
    }
    
    return annotations[index];
  }
  
  async remove(id) {
    const annotations = await database.get(STORAGE_KEY, []);
    
    const updated = annotations.filter(
      item => item.id !== id
    );
    
    const saved = await database.set(STORAGE_KEY, updated);
    
    if (!saved) {
      throw new Error("Could not delete annotation.");
    }
    
    return true;
  }
  
}