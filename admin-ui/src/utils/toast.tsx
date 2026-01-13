import { useState, useEffect } from 'react';
import './toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const toasts: Toast[] = [];
const listeners: Set<() => void> = new Set();

export const toast = {
  show: (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = toastId++;
    const toast: Toast = { id, message, type };
    toasts.push(toast);
    notifyListeners();

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  },
  success: (message: string, duration?: number) => toast.show(message, 'success', duration),
  error: (message: string, duration?: number) => toast.show(message, 'error', duration),
  warning: (message: string, duration?: number) => toast.show(message, 'warning', duration),
  info: (message: string, duration?: number) => toast.show(message, 'info', duration),
  remove: (id: number) => removeToast(id),
};

function removeToast(id: number) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
    notifyListeners();
  }
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function useToasts() {
  const [, setState] = useState(0);

  useEffect(() => {
    const listener = () => setState((s) => s + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return toasts;
}

export function ToastContainer() {
  const toasts = useToasts();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => toast.remove(toast.id)} className="toast-close">×</button>
        </div>
      ))}
    </div>
  );
}
