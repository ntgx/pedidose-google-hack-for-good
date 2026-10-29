import React, { useState } from 'react';
import { TaperingStep } from '../utils/dosingCalculator';

interface TaperingChartProps {
  schedule: TaperingStep[];
}

// Chart tokens shared with DoseCeilingChart: one identity hue for the dose, recessive grid & ink
const DOSE = '#4f46e5';
const SKIP = '#94a3b8';
const GRID = '#e2e8f0';
const INK = '#334155';
const INK_MUTED = '#64748b';

const W = 640;
const H = 190;
const M = { top: 44, right: 8, bottom: 30, left: 8 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

interface DaySlot {
  day: number;
  step: TaperingStep | null; // null = the "stop" day after the last phase
  given: boolean;
}

const doseText = (s: TaperingStep) => `${s.morningDoseMg} mg${s.morningVolumeMl ? ` · ${s.morningVolumeMl} mL` : ''}`;

// Bar with 4px rounded top corners, square at the baseline
const barPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
};

// One bar per morning so the caregiver-facing taper reads as a calendar: height = dose, gaps = no dose
export const TaperingChart: React.FC<TaperingChartProps> = ({ schedule }) => {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  if (schedule.length === 0) return null;

  const lastDay = schedule[schedule.length - 1].endDay;
  const slots: DaySlot[] = [];
  for (const s of schedule) {
    for (let d = s.startDay; d <= s.endDay; d++) {
      slots.push({ day: d, step: s, given: !s.everyOtherDay || (d - s.startDay) % 2 === 0 });
    }
  }
  slots.push({ day: lastDay + 1, step: null, given: false });

  const slotW = PW / slots.length;
  const barW = slotW - 3; // 3px surface gap between adjacent bars
  const xOf = (day: number) => M.left + (day - 1) * slotW;
  const yMax = Math.max(...schedule.map((s) => s.morningDoseMg)) || 1;
  const hOf = (mg: number) => (mg / yMax) * PH;
  const baseY = M.top + PH;

  const hover = hoverDay !== null ? slots.find((s) => s.day === hoverDay) ?? null : null;
  const doseDays = slots.filter((s) => s.given).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-600 mb-1">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect x="0" y="0" width="10" height="10" rx="2" fill={DOSE} />
          </svg>
          Morning dose
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" rx="2" fill="none" stroke={SKIP} strokeDasharray="2 2" />
          </svg>
          No dose
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label={`Steroid taper over ${lastDay} days: ${schedule
            .map((s) => `${s.daysLabel.toLowerCase()} ${s.morningDoseMg} mg${s.everyOtherDay ? ' every other morning' : ''}`)
            .join(', ')}; stop on day ${lastDay + 1}. ${doseDays} doses in total.`}
          onPointerLeave={() => setHoverDay(null)}
        >
          {/* Phase headers, dose label and dividers */}
          {schedule.map((s, i) => {
            const x0 = xOf(s.startDay);
            const x1 = xOf(s.endDay + 1);
            const cx = (x0 + x1 - 3) / 2;
            const topY = baseY - hOf(s.morningDoseMg);
            return (
              <g key={s.phase}>
                {i > 0 && <line x1={x0 - 1.5} x2={x0 - 1.5} y1={6} y2={baseY} stroke={GRID} strokeWidth="1" />}
                <text x={cx} y={14} fontSize="10" fill={INK_MUTED} textAnchor="middle">
                  {s.shortLabel}
                </text>
                <text x={cx} y={Math.min(30, topY - 6)} fontSize="11" fontWeight="600" fill={INK} textAnchor="middle">
                  {doseText(s)}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={M.left} x2={M.left + PW} y1={baseY} y2={baseY} stroke="#cbd5e1" strokeWidth="1" />

          {/* One mark per morning */}
          {slots.map((slot) => {
            const x = xOf(slot.day);
            const active = hoverDay === slot.day;
            if (!slot.step) {
              return (
                <text key={slot.day} x={x + barW / 2} y={baseY - 6} fontSize="10" fontWeight="600" fill={INK} textAnchor="middle">
                  Stop
                </text>
              );
            }
            const h = hOf(slot.step.morningDoseMg);
            return slot.given ? (
              <path key={slot.day} d={barPath(x, baseY - h, barW, h)} fill={DOSE} opacity={hoverDay === null || active ? 1 : 0.55} />
            ) : (
              <rect
                key={slot.day}
                x={x + 0.5}
                y={baseY - h + 0.5}
                width={barW - 1}
                height={h - 1}
                rx="3"
                fill="none"
                stroke={SKIP}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Day ticks: first and last day of each phase, plus the stop day */}
          {slots
            .filter((s) => !s.step || s.day === s.step.startDay || s.day === s.step.endDay)
            .map((s) => (
              <text key={s.day} x={xOf(s.day) + barW / 2} y={baseY + 14} fontSize="10" fill={INK_MUTED} textAnchor="middle">
                {s.day}
              </text>
            ))}
          <text x={M.left + PW / 2} y={H - 3} fontSize="10" fill={INK_MUTED} textAnchor="middle">
            Day
          </text>

          {/* Hit targets: the whole column, larger than the bar */}
          {slots.map((slot) => (
            <rect
              key={slot.day}
              x={xOf(slot.day)}
              y={0}
              width={slotW}
              height={H}
              fill="transparent"
              onPointerEnter={() => setHoverDay(slot.day)}
            />
          ))}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md bg-slate-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{
              left: `${((xOf(hover.day) + (xOf(hover.day) > W * 0.6 ? 0 : slotW)) / W) * 100}%`,
              transform: xOf(hover.day) > W * 0.6 ? 'translateX(calc(-100% - 4px))' : 'translateX(4px)',
            }}
          >
            <div className="font-medium">Day {hover.day}</div>
            {hover.step ? (
              <>
                <div>{hover.given ? doseText(hover.step) : 'No dose today'}</div>
                <div className="text-slate-300">{hover.step.phase}</div>
              </>
            ) : (
              <div>Course finished — no more doses</div>
            )}
          </div>
        )}
      </div>

      {/* Table view for screen readers / exact values */}
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="mt-1.5 w-full text-left">
          <thead>
            <tr className="text-slate-400">
              <th className="font-medium py-1">Days</th>
              <th className="font-medium py-1">Phase</th>
              <th className="font-medium py-1">Morning dose</th>
              <th className="font-medium py-1">Notes</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {schedule.map((s) => (
              <tr key={s.phase} className="border-t border-slate-100 align-top">
                <td className="py-1 whitespace-nowrap">{s.daysLabel}</td>
                <td className="py-1">{s.phase}</td>
                <td className="py-1 font-mono whitespace-nowrap">{doseText(s)}</td>
                <td className="py-1">{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};
