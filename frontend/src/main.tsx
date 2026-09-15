import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { convertArabicToEnglishNumbers } from './utils/quranHelpers'

const queryClient = new QueryClient()

// Global handler to convert any typed or pasted Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard English numerals (0123456789)
if (typeof window !== 'undefined') {
  document.addEventListener(
    'input',
    (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || !('value' in target)) return;
      if (
        target.type === 'password' ||
        target.type === 'file' ||
        target.type === 'checkbox' ||
        target.type === 'radio'
      ) {
        return;
      }

      if (typeof target.value === 'string' && /[٠-٩۰-۹]/.test(target.value)) {
        const converted = convertArabicToEnglishNumbers(target.value);
        if (converted !== target.value) {
          const proto =
            target instanceof HTMLTextAreaElement
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(target, converted);
          } else {
            target.value = converted;
          }
          // Dispatch synthetic input event to inform React controlled components
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    true
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
