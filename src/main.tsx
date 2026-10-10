// Suppress noisy TensorFlow Lite / XNNPACK info messages from being treated as errors
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

const isTfliteNoise = (...args: unknown[]) => {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) || '')).join(' ');
  return msg.includes('Created TensorFlow Lite XNNPACK delegate') || msg.includes('XNNPACK');
};

console.error = (...args: unknown[]) => {
  if (isTfliteNoise(...args)) return;
  originalError(...args);
};

console.warn = (...args: unknown[]) => {
  if (isTfliteNoise(...args)) return;
  originalWarn(...args);
};

console.info = (...args: unknown[]) => {
  if (isTfliteNoise(...args)) return;
  originalInfo(...args);
};

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
