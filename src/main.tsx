import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme } from './lib/theme'

// Set the saved theme before the first paint, so the page never flashes the wrong one.
applyTheme()

const root = document.getElementById('root')!

// The app is loaded after the setup check, so a missing setting shows a message
// instead of a blank page.
import('./App')
  .then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message = document.createElement('p')
    message.className = 'mx-auto max-w-md px-6 py-20 text-center text-[15px] text-ink-2'
    message.textContent =
      error instanceof Error && error.message.startsWith('Missing VITE_')
        ? "Laced isn't connected to its database yet. The site owner needs to add the Supabase settings and deploy again."
        : "Laced couldn't start. Reload the page, and tell the owner if it keeps happening."
    root.replaceChildren(message)
  })
