import { useEffect, useRef } from 'react';

type ToastType = 'success' | 'err' | 'warn' | 'info';

const icons: Record<ToastType, string> = {
  success: '✅', err: '❌', warn: '⚠️', info: 'ℹ️',
};

export function showToast(msg: string, type: ToastType = 'success') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type !== 'success' ? type : ''}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'tout .4s ease forwards';
    setTimeout(() => el.remove(), 400);
  }, 3600);
}

export default function ToastContainer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Expose globally so non-React code can call it
    (window as unknown as Record<string, unknown>).showToast = showToast;
  }, []);
  return <div id="toasts" ref={ref} />;
}
