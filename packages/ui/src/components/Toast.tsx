'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '../lib/cx';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  kind: ToastKind;
  /**
   * For errors this is `ApiErr.message` verbatim — contract-guaranteed safe.
   * Never pass `ApiErr.details` (machine data, never rendered).
   */
  message: string;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Identical messages within 2s coalesce: rendered as "message ×count". */
  count: number;
  createdAt: number;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;
const COALESCE_WINDOW_MS = 2000;

const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast queue. Must be rendered inside `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'border-success',
  error: 'border-danger',
  info: 'border-line',
};

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast queue provider + viewport. Max 3 visible with FIFO eviction,
 * identical messages within 2s coalesce with a count suffix, 5s
 * auto-dismiss, announced via `aria-live="polite"`.
 */
export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: number): void => {
      const existing = timersRef.current.get(id);
      if (existing !== undefined) clearTimeout(existing);
      timersRef.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  const toast = useCallback(
    ({ kind, message }: ToastOptions): void => {
      const now = Date.now();
      setItems((current) => {
        // Coalesce with an identical message inside the 2s window.
        const duplicate = current.find(
          (item) =>
            item.kind === kind &&
            item.message === message &&
            now - item.createdAt <= COALESCE_WINDOW_MS,
        );
        if (duplicate !== undefined) {
          scheduleDismiss(duplicate.id);
          return current.map((item) =>
            item.id === duplicate.id
              ? { ...item, count: item.count + 1, createdAt: now }
              : item,
          );
        }
        const id = nextIdRef.current;
        nextIdRef.current += 1;
        scheduleDismiss(id);
        const next = [...current, { id, kind, message, count: 1, createdAt: now }];
        // FIFO eviction beyond the visible cap.
        while (next.length > MAX_VISIBLE) {
          const evicted = next.shift();
          if (evicted !== undefined) {
            const timer = timersRef.current.get(evicted.id);
            if (timer !== undefined) {
              clearTimeout(timer);
              timersRef.current.delete(evicted.id);
            }
          }
        }
        return next;
      });
    },
    [scheduleDismiss],
  );

  // Clear all pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cx(
              'pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border-l-4 bg-card px-4 py-3 shadow-lg',
              KIND_CLASSES[item.kind],
            )}
          >
            <p className="font-body text-sm text-ink">
              {item.count > 1 ? `${item.message} ×${item.count}` : item.message}
            </p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => {
                dismiss(item.id);
              }}
              className={cx(
                'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-espresso transition-colors',
                'hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
              )}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
