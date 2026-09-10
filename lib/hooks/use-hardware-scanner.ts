'use client';

import { useEffect, useRef } from 'react';

// A USB/Bluetooth handheld barcode scanner behaves like a very fast typist:
// it "types" each character of the barcode into whatever has focus and then
// sends Enter — there is no camera or browser API involved at all. This hook
// listens for that pattern anywhere on the page (not just inside one search
// box) so scanning works the moment the gun is triggered, without the user
// needing to click into a specific field first.
//
// Genuine human typing in the app's own fields is left completely alone:
// the listener only looks at keystrokes that land with nothing text-like
// focused, and only acts once a fast burst of characters is closed off with
// Enter.
const MAX_GAP_MS = 60;
const MIN_CODE_LENGTH = 3;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useHardwareScannerListener(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // A field the user is deliberately typing into (including the
      // barcode search box itself, which already handles scans on its own)
      // is left untouched.
      if (isEditableTarget(document.activeElement)) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;
      if (gap > MAX_GAP_MS && bufferRef.current) {
        // The previous keystroke was too slow to be part of the same
        // scanner burst — start a fresh buffer.
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= MIN_CODE_LENGTH) {
          event.preventDefault();
          onScanRef.current(code);
        }
        return;
      }
      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      bufferRef.current = '';
    };
  }, [enabled]);
}
