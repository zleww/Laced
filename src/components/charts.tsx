import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

// Small, dependency-free charts drawn as SVG. One series each, in grey:
// the numbers are the point, not the color.

export type ChartPoint = {
  label: string // short, for the axis: "Nov 16"
  longLabel: string // full, for the tooltip and table: "Mon, Nov 16"
  value: number
}

type ChartProps = {
  kind: 'area' | 'bars'
  points: ChartPoint[]
  /** Full value, for the tooltip: "₱28,917" */
  format: (value: number) => string
  /** Short value, for the axis: "₱30K" */
  formatTick: (value: number) => string
  /** One sentence for screen readers. */
  summary: string
}

const HEIGHT = 220
const PAD = { top: 16, right: 12, bottom: 28, left: 46 }

/** Rounds a maximum up to a tidy axis top: 28,917 -> 40,000 with 4 steps. */
function axisTop(max: number): number {
  if (max <= 0) return 4
  const power = 10 ** Math.floor(Math.log10(max))
  const lead = max / power
  const step = lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 4 ? 4 : lead <= 8 ? 8 : 10
  return step * power
}

/** The width of an element, kept up to date as the screen or sidebar resizes. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export function Chart({ kind, points, format, formatTick, summary }: ChartProps) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const top = axisTop(Math.max(...points.map((point) => point.value), 0))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * top)
  const count = points.length

  // Area: points sit on the edges. Bars: each bar sits in the middle of its band.
  const band = plotWidth / Math.max(count, 1)
  const x = (index: number) =>
    PAD.left + (kind === 'bars' ? band * (index + 0.5) : count > 1 ? (plotWidth * index) / (count - 1) : plotWidth / 2)
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight
  const baseline = PAD.top + plotHeight

  // Show as many axis labels as fit (about one per 76px), always including the last (today).
  const labelEvery = Math.max(Math.ceil(count / Math.max(Math.floor(plotWidth / 76), 2)), 1)
  const showLabel = (index: number) => (count - 1 - index) % labelEvery === 0

  function nearest(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const offset = event.clientX - box.left - PAD.left
    const index = kind === 'bars' ? Math.floor(offset / band) : Math.round((offset / plotWidth) * (count - 1))
    setActive(Math.min(Math.max(index, 0), count - 1))
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowLeft' ? -1 : 1
    setActive((current) => Math.min(Math.max((current ?? count - 1) + step, 0), count - 1))
  }

  const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.value)}`).join(' ')
  const barWidth = Math.min(24, band * 0.62)
  const current = active === null ? null : points[active]

  return (
    <div ref={ref} className="relative min-w-0">
      {width > 0 && count > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onPointerMove={nearest}
          onPointerDown={nearest}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="block touch-pan-y rounded-control outline-offset-4"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--mark)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--mark)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {kind === 'area' ? (
            <>
              <path d={`${linePath} L${x(count - 1)},${baseline} L${x(0)},${baseline} Z`} fill={`url(#${gradientId})`} />
              <path d={linePath} fill="none" stroke="var(--mark)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            points.map((point, index) => {
              const height = Math.max(baseline - y(point.value), point.value > 0 ? 2 : 0)
              const left = x(index) - barWidth / 2
              const radius = Math.min(4, height)
              // Rounded at the data end, square on the baseline.
              return (
                <path
                  key={point.longLabel}
                  d={`M${left},${baseline} v${-(height - radius)} q0,${-radius} ${radius},${-radius} h${barWidth - 2 * radius} q${radius},0 ${radius},${radius} v${height - radius} Z`}
                  fill={index === active ? 'var(--mark)' : 'var(--mark-soft)'}
                />
              )
            })
          )}

          {current && active !== null && kind === 'area' && (
            <>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={baseline} stroke="var(--ink-3)" strokeWidth="1" />
              <circle cx={x(active)} cy={y(current.value)} r="5" fill="var(--mark)" stroke="var(--card)" strokeWidth="2" />
            </>
          )}

          {points.map((point, index) =>
            index === active ? (
              // The hovered day is called out on the axis as a solid pill.
              <g key={point.longLabel} transform={`translate(${Math.min(Math.max(x(index), PAD.left + 28), width - PAD.right - 28)},${HEIGHT - 12})`}>
                <rect x="-28" y="-11" width="56" height="22" rx="11" fill="var(--accent)" />
                <text textAnchor="middle" dy="0.34em" className="text-[11px] font-medium" fill="var(--on-accent)">
                  {point.label}
                </text>
              </g>
            ) : (
              showLabel(index) &&
              active === null && (
                <text
                  key={point.longLabel}
                  x={x(index)}
                  y={HEIGHT - 12}
                  dy="0.34em"
                  textAnchor={index === count - 1 && kind === 'area' ? 'end' : 'middle'}
                  className="fill-ink-3 text-[11px]"
                >
                  {point.label}
                </text>
              )
            ),
          )}
        </svg>
      )}

      {current && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control border border-line bg-raised px-3 py-2 whitespace-nowrap shadow-lg"
          style={{
            left: Math.min(Math.max(x(active), 70), Math.max(width - 70, 70)),
            top: Math.max(y(current.value) - 12, 46),
          }}
        >
          <p className="text-[11px] text-ink-2">{current.longLabel}</p>
          <p className="text-[14px] font-semibold tabular-nums">{format(current.value)}</p>
        </div>
      )}
    </div>
  )
}

type ChartCardProps = {
  title: string
  /** The headline number for the whole range. */
  figure: string
  caption: string
  points: ChartPoint[]
  format: (value: number) => string
  valueHeading: string
  /** First column of the table view. */
  labelHeading?: string
  children: ReactNode
}

/** A panel holding a chart, its headline number, and a switch to the same data as a table. */
export function ChartCard({
  title,
  figure,
  caption,
  points,
  format,
  valueHeading,
  labelHeading = 'Day',
  children,
}: ChartCardProps) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="sheen min-w-0 rounded-card border border-line bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] text-ink-2">{title}</h2>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{figure}</p>
          <p className="mt-1.5 text-[12px] text-ink-3">{caption}</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
          className="min-h-9 rounded-full border border-line px-3 text-[12px] font-medium text-ink-2 hover:text-ink"
        >
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      <div className="mt-4">
        {asTable ? (
          <div className="max-h-[220px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card text-left text-ink-3">
                <tr>
                  <th className="py-1.5 font-medium">{labelHeading}</th>
                  <th className="py-1.5 text-right font-medium">{valueHeading}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...points].reverse().map((point) => (
                  <tr key={point.longLabel}>
                    <td className="py-1.5">{point.longLabel}</td>
                    <td className="py-1.5 text-right tabular-nums">{format(point.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
