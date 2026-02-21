/**
 * Keyboard shortcuts hook for POS operations
 * Provides quick access to common POS functions
 */

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutConfig {
  keys: string[];
  description: string;
  action: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input field
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' ||
                           target.tagName === 'TEXTAREA' ||
                           target.contentEditable === 'true';

      if (isInputField) return;

      // Check each shortcut
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // Check if all keys in the shortcut are pressed
        const allKeysPressed = shortcut.keys.every(key => {
          // Handle modifier keys
          if (key === 'Ctrl' && (event.ctrlKey || event.metaKey)) return true;
          if (key === 'Shift' && event.shiftKey) return true;
          if (key === 'Alt' && event.altKey) return true;
          if (key === 'Cmd' && event.metaKey) return true;

          // Handle regular keys
          if (key.length === 1) {
            return event.key === key;
          }

          return false;
        });

        if (allKeysPressed) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Common POS keyboard shortcuts
 */
export const POS_SHORTCUTS = {
  // Cart operations
  ADD_ITEM: ['N'],
  REMOVE_ITEM: ['Delete'],
  CLEAR_CART: ['Escape'],
  PROCESS_ORDER: ['F2'],

  // Navigation
  NAV_UP: ['ArrowUp'],
  NAV_DOWN: ['ArrowDown'],
  NAV_LEFT: ['ArrowLeft'],
  NAV_RIGHT: ['ArrowRight'],
  GO_HOME: ['Home'],

  // Search
  QUICK_SEARCH: ['Ctrl', 'K'], // Cmd + K on Mac
  ADVANCED_SEARCH: ['Ctrl', 'Shift', 'F'],

  // Actions
  OPEN_CASH_DRAWER: ['F4'],
  PRINT_RECEIPT: ['F5'],
  NEW_ORDER: ['F6'],
  HOLD_ORDER: ['F7'],
  RECALL_ORDER: ['F8'],

  // Management
  OPEN_SHIFT: ['Ctrl', '1'],
  CLOSE_SHIFT: ['Ctrl', '2'],
  MANAGE_INVENTORY: ['Ctrl', 'I'],
  MANAGE_MENU: ['Ctrl', 'M'],
  MANAGE_CUSTOMERS: ['Ctrl', 'C'],
  VIEW_REPORTS: ['Ctrl', 'R'],

  // Quick quantities
  QTY_1: ['1'],
  QTY_2: ['2'],
  QTY_3: ['3'],
  QTY_4: ['4'],
  QTY_5: ['5'],
  QTY_6: ['6'],
  QTY_7: ['7'],
  QTY_8: ['8'],
  QTY_9: ['9'],
  QTY_0: ['0'],
} as const;

/**
 * Get shortcut description for display
 */
export function getShortcutDescription(keys: string[]): string {
  return keys.map(key => {
    // Map special keys
    const keyMap: Record<string, string> = {
      'Ctrl': 'Ctrl',
      'Shift': 'Shift',
      'Alt': 'Alt',
      'Cmd': '⌘',
      'Delete': 'Del',
      'Escape': 'Esc',
      'Enter': 'Enter',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
    };

    return keyMap[key] || key;
  }).join(' + ');
}

/**
 * Check if shortcut is pressed
 */
export function isShortcutPressed(event: KeyboardEvent, shortcut: string[]): boolean {
  if (shortcut.length === 1) {
    return event.key === shortcut[0];
  }

  return shortcut.every(key => {
    if (key === 'Ctrl') return event.ctrlKey || event.metaKey;
    if (key === 'Shift') return event.shiftKey;
    if (key === 'Alt') return event.altKey;
    if (key === 'Cmd') return event.metaKey;
    if (key.length === 1) return event.key === key;
    return false;
  });
}
