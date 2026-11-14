import { database } from "../storage/database.js";

const STORAGE_KEY = "annotations";

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readAnnotations() {
  const stored = await database.get(STORAGE_KEY, []);
  
  return Array.isArray(stored) ? stored : [];
}

async function saveAnnotations(annotations, errorMessage) {
  const saved = await database.set(STORAGE_KEY, annotations);
  
  if (!saved) {
    throw new Error(errorMessage);
  }
}

export class AnnotationService {
  async getAll(documentId) {
    if (!documentId) return [];
    
    const annotations = await readAnnotations();
    
    return annotations
      .filter(item => item.documentId === documentId)
      .sort((a, b) =>
        new Date(a.createdAt || 0) -
        new Date(b.createdAt || 0)
      );
  }
  
  async add(documentId, annotation) {
    if (!documentId) {
      throw new TypeError("A document ID is required.");
    }
    
    if (!annotation || !annotation.type) {
      throw new TypeError("An annotation type is required.");
    }
    
    const annotations = await readAnnotations();
    
    const now = new Date().toISOString();
    
    const item = {
      id: createId(),
      documentId,
      createdAt: now,
      updatedAt: now,
      ...annotation
    };
    
    annotations.push(item);
    
    await saveAnnotations(
      annotations,
      "Could not save annotation."
    );
    
    return item;
  }
  
  async update(id, changes) {
    const annotations = await readAnnotations();
    
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
    
    await saveAnnotations(
      annotations,
      "Could not update annotation."
    );
    
    return annotations[index];
  }
  
  async remove(id) {
    const annotations = await readAnnotations();
    
    const updated = annotations.filter(
      item => item.id !== id
    );
    
    if (updated.length === annotations.length) {
      return false;
    }
    
    await saveAnnotations(
      updated,
      "Could not delete annotation."
    );
    
    return true;
  }
}