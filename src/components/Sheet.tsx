import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { CloseIcon } from './icons'

type SheetProps = { open: boolean; title: string; onClose: () => void; children: ReactNode }

// A panel that slides over the screen from the bottom. It uses the browser's
// own <dialog>, which keeps keyboard focus inside the panel and closes on Escape.
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the dimmed area outside the panel lands on the dialog itself.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[20px] border-t border-line bg-card p-0 text-ink backdrop:bg-black/50"
    >
      {open && (
        <div className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-11 place-items-center rounded-full text-ink-2"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
