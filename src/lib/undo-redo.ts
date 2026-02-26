/**
 * Undo/Redo manager for cart operations
 * Maintains history of cart states for rollback capability
 */

export interface CartState {
  items: any[];
  total: number;
  customer?: any;
  notes?: string;
  timestamp: number;
}

class UndoRedoManager {
  private past: CartState[] = [];
  private future: CartState[] = [];
  private maxHistory: number = 50;
  private currentState: CartState | null = null;

  /**
   * Record new state
   */
  pushState(state: CartState): void {
    // Remove current state from future when pushing new state
    this.future = [];

    // Add to past
    this.past.push(state);

    // Keep history under limit
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }

    this.currentState = state;
  }

  /**
   * Undo last action
   */
  undo(): CartState | null {
    if (this.past.length === 0) {
      return null;
    }

    // Get previous state
    const previousState = this.past.pop();
    this.future.push(this.currentState!);

    this.currentState = previousState;
    return previousState;
  }

  /**
   * Redo last undone action
   */
  redo(): CartState | null {
    if (this.future.length === 0) {
      return null;
    }

    // Get next state
    const nextState = this.future.pop();
    this.past.push(this.currentState!);

    this.currentState = nextState;
    return nextState;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Get current state
   */
  getCurrentState(): CartState | null {
    return this.currentState;
  }

  /**
   * Get history info
   */
  getHistoryInfo() {
    return {
      pastCount: this.past.length,
      futureCount: this.future.length,
      totalHistory: this.past.length + this.future.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
    this.currentState = null;
  }
}

// Singleton instance
const undoRedoManager = new UndoRedoManager();

/**
 * Get undo/redo manager instance
 */
export function getUndoRedoManager(): UndoRedoManager {
  return undoRedoManager;
}

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo() {
  const manager = getUndoRedoManager();

  return {
    undo: () => manager.undo(),
    redo: () => manager.redo(),
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    getCurrentState: () => manager.getCurrentState(),
    getHistoryInfo: () => manager.getHistoryInfo(),
    clear: () => manager.clear(),
    pushState: (state: CartState) => manager.pushState(state),
  };
}
