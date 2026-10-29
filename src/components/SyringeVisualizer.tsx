import React, { useRef, useState } from 'react';
import { AlertOctagon, CheckCircle2, MoveHorizontal, Sparkles } from 'lucide-react';

interface SyringeVisualizerProps {
  targetVolumeMl: number;
  enteredVolumeMl: number;
  concentrationMgPerMl: number;
  medicationName: string;
  /** Second line under the live volume, e.g. "= 0.25 mg/kg/day" — lets the prescriber see the dose they're setting */
  doseRateLabel?: string;
  /** Deliberately adopt the drawn-up volume as the new dose ("Change the dose to match") */
  onSetDoseVolume: (volumeMl: number) => void;
  /** The volume drawn up on the syringe; null means it equals the calculated volume */
  onChangeEnteredVolume: (newVol: number | null) => void;
}

const SYRINGE_SIZES = [
  { ml: 1, step: 0.01 },
  { ml: 5, step: 0.1 },
  { ml: 10, step: 0.2 },
];

const MATCH_TOLERANCE = 0.05;

// Barrel geometry inside the SVG viewBox
const BARREL_X = 40;
const BARREL_W = 420;

export const SyringeVisualizer: React.FC<SyringeVisualizerProps> = ({
  targetVolumeMl,
  enteredVolumeMl,
  concentrationMgPerMl,
  medicationName,
  doseRateLabel,
  onSetDoseVolume,
  onChangeEnteredVolume,
}) => {
  const recommendedSizeMl = targetVolumeMl <= 1.0 ? 1 : targetVolumeMl <= 5.0 ? 5 : 10;
  const [chosenSizeMl, setChosenSizeMl] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Barrel follows the recommendation unless the user picked one; frozen while dragging so the scale doesn't jump
  const frozenSize = useRef<number>(recommendedSizeMl);
  const sizeMl = dragging ? frozenSize.current : chosenSizeMl ?? recommendedSizeMl;
  const { step } = SYRINGE_SIZES.find((s) => s.ml === sizeMl)!;

  // An entered volume beyond the barrel (e.g. the 10x mistake) stretches the scale so it stays visible;
  // the scale is frozen for the whole drag so the plunger tracks the pointer exactly
  const frozenMax = useRef<number>(sizeMl);
  const displayMaxMl = dragging ? frozenMax.current : Math.max(sizeMl, Math.min(100, enteredVolumeMl));
  const pct = (v: number) => Math.min(100, Math.max(0, (v / displayMaxMl) * 100));

  // Anything more than 5% off the calculated volume is a mismatch (graduation rounding stays inside that)
  const ratio = targetVolumeMl > 0 ? enteredVolumeMl / targetVolumeMl : 1;
  const isDangerDiscrepancy = Math.abs(ratio - 1) > MATCH_TOLERANCE;

  const snap = (v: number) => Math.max(step, Math.round(v / step) * step);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const drawUp = (v: number) =>
    onChangeEnteredVolume(
      targetVolumeMl > 0 && Math.abs(v / targetVolumeMl - 1) <= MATCH_TOLERANCE ? null : v
    );

  const volumeAtClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const local = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const frac = Math.min(1, Math.max(0, (local.x - BARREL_X) / BARREL_W));
    return round2(snap(frac * frozenMax.current));
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    frozenSize.current = sizeMl;
    frozenMax.current = displayMaxMl;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = volumeAtClientX(e.clientX);
    if (v !== null) drawUp(v);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const v = volumeAtClientX(e.clientX);
    if (v !== null && v !== round2(enteredVolumeMl)) drawUp(v);
  };

  const endDrag = () => {
    setDragging(false);
    // Keep the barrel the user dragged in, so the plunger doesn't jump to a new scale on release
    setChosenSizeMl(frozenSize.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const delta = e.shiftKey ? step * 10 : step;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = enteredVolumeMl + delta;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = enteredVolumeMl - delta;
    if (e.key === 'Home') next = step;
    if (e.key === 'End') next = sizeMl;
    if (next !== null) {
      e.preventDefault();
      drawUp(round2(Math.min(sizeMl, Math.max(step, snap(next)))));
    }
  };

  const ticks = Array.from({ length: 11 }, (_, i) => ({
    val: (displayMaxMl * i) / 10,
    x: BARREL_X + (BARREL_W * i) / 10,
  }));
  const plungerX = BARREL_X + (BARREL_W * pct(enteredVolumeMl)) / 100;
  const safeX = BARREL_X + (BARREL_W * pct(targetVolumeMl)) / 100;
  const enteredMg = enteredVolumeMl * concentrationMgPerMl;

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isDangerDiscrepancy ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          {isDangerDiscrepancy ? (
            <AlertOctagon className="w-4 h-4 mt-0.5 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-teal-600" />
          )}
          <div>
            <h4 className="text-sm font-medium text-slate-900" title={`${medicationName} ${concentrationMgPerMl} mg/mL`}>
              Draw up the dose on the syringe
            </h4>
            <p className="text-xs text-slate-500">
              Drag the plunger (or use the arrow keys) to the volume you’d give. It’s checked against the
              calculated dose · {concentrationMgPerMl} mg per mL.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Barrel size: recommended one is preselected; others let you set larger/smaller volumes */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Syringe size">
            {SYRINGE_SIZES.map((s) => (
              <button
                key={s.ml}
                type="button"
                onClick={() => setChosenSizeMl(s.ml === recommendedSizeMl ? null : s.ml)}
                className={`px-2 py-1 rounded-md cursor-pointer ${
                  sizeMl === s.ml ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={s.ml === recommendedSizeMl ? 'Recommended size for this dose' : undefined}
              >
                {s.ml} mL{s.ml === recommendedSizeMl ? ' ★' : ''}
              </button>
            ))}
          </div>
          {isDangerDiscrepancy ? null : (
            <button
              type="button"
              onClick={() => onChangeEnteredVolume(round2(targetVolumeMl * 10))}
              className="text-xs px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Simulate the classic decimal-point error: a volume written 10× larger than the calculated dose"
            >
              Try a 10× mistake
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-100 p-3">
        {/* Live readout of what the plunger is set to */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div>
            <span className={`text-2xl font-semibold font-mono ${isDangerDiscrepancy ? 'text-rose-700' : 'text-slate-900'}`}>
              {enteredVolumeMl.toFixed(2)} mL
            </span>
            <span className="ml-2 text-sm text-slate-600">= {enteredMg.toFixed(enteredMg < 10 ? 2 : 1)} mg</span>
            {doseRateLabel && !isDangerDiscrepancy && (
              <span className="ml-2 text-sm text-slate-400">{doseRateLabel}</span>
            )}
          </div>
          {isDangerDiscrepancy ? (
            <span className="text-xs font-medium text-rose-700">
              {ratio > 1 ? `${ratio.toFixed(1)}× too much` : `only ${Math.round(ratio * 100)}% of the dose`} — the
              calculated dose is {targetVolumeMl.toFixed(2)} mL
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Matches the calculated dose
            </span>
          )}
        </div>

        {isDangerDiscrepancy && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => onChangeEnteredVolume(null)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fix: draw {targetVolumeMl.toFixed(2)} mL
            </button>
            <button
              type="button"
              onClick={() => onSetDoseVolume(round2(enteredVolumeMl))}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Recalculates the protocol dose from this volume; dose checks still apply"
            >
              I meant {round2(enteredVolumeMl)} mL — change the dose to match
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 650 115"
          className={`w-full h-28 select-none touch-none outline-none rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            dragging ? 'cursor-grabbing' : 'cursor-ew-resize'
          }`}
          role="slider"
          tabIndex={0}
          aria-label="Volume per dose in mL"
          aria-valuemin={step}
          aria-valuemax={sizeMl}
          aria-valuenow={round2(enteredVolumeMl)}
          aria-valuetext={`${enteredVolumeMl.toFixed(2)} mL, ${enteredMg.toFixed(1)} mg`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
        >
          {/* EnFit tip */}
          <rect x="12" y="43" width="28" height="18" rx="3" fill="#7e22ce" stroke="#581c87" strokeWidth="1.5" />
          <text x="13" y="36" fontSize="9" fontWeight="700" fill="#6b21a8">
            EnFit
          </text>

          {/* Barrel */}
          <rect x={BARREL_X} y="24" width={BARREL_W} height="56" rx="4" fill="#f8fafc" stroke="#475569" strokeWidth="2" />

          {/* Liquid drawn up (to the plunger) */}
          <rect
            x={BARREL_X + 1}
            y="25"
            width={Math.max(0, plungerX - BARREL_X - 1)}
            height="54"
            fill={isDangerDiscrepancy ? 'rgba(244, 63, 94, 0.3)' : 'rgba(13, 148, 136, 0.4)'}
          />

          {/* Calculated dose marker — only needed when the plunger disagrees with it */}
          {isDangerDiscrepancy && (
            <g>
              <line x1={safeX} y1="14" x2={safeX} y2="92" stroke="#0f766e" strokeWidth="2.5" strokeDasharray="4 2" />
              <text x={Math.min(400, Math.max(42, safeX - 30))} y="11" fontSize="10" fontWeight="800" fill="#0f766e">
                CORRECT: {targetVolumeMl.toFixed(2)} mL
              </text>
            </g>
          )}

          {/* Graduations */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1="66" x2={t.x} y2="80" stroke="#334155" strokeWidth={i % 2 === 0 ? 2 : 1} />
              {i % 2 === 0 && (
                <text x={t.x} y="96" fontSize="10" fontWeight="600" fill="#334155" fontFamily="monospace" textAnchor="middle">
                  {t.val.toFixed(displayMaxMl <= 1 ? 1 : 0)}
                </text>
              )}
            </g>
          ))}
          <text x={BARREL_X + BARREL_W + 8} y="96" fontSize="10" fontWeight="700" fill="#475569">
            mL
          </text>

          {/* Plunger: black rubber ring at the volume, purple rod and thumb press behind it */}
          <rect x={plungerX} y="25" width="10" height="54" rx="2" fill={isDangerDiscrepancy ? '#dc2626' : '#1e293b'} />
          <rect
            x={plungerX + 10}
            y="42"
            width={Math.max(40, 560 - plungerX)}
            height="20"
            fill={isDangerDiscrepancy ? '#f43f5e' : '#9333ea'}
            opacity="0.85"
          />
          <rect
            x={Math.max(plungerX + 50, 560)}
            y="24"
            width="14"
            height="56"
            rx="3"
            fill={isDangerDiscrepancy ? '#be123c' : '#6b21a8'}
          />
          {/* Grab affordance on the thumb press */}
          <g transform={`translate(${Math.max(plungerX + 50, 560) + 7}, 104)`}>
            <text fontSize="9" fill="#64748b" textAnchor="middle">
              drag
            </text>
          </g>
        </svg>

        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2">
            <MoveHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600">Or type the volume:</span>
            <input
              type="number"
              step={step}
              min={0.01}
              max={100}
              value={round2(enteredVolumeMl)}
              onChange={(e) => drawUp(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              className={`w-20 px-2 py-1 rounded-md font-mono font-semibold border ${
                isDangerDiscrepancy ? 'bg-rose-100 border-rose-500 text-rose-900' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <span className="text-slate-500">mL</span>
          </label>
          <span className="text-[11px] text-slate-500">
            For parents: line up the top of the black ring with the{' '}
            <strong className="text-teal-700">{targetVolumeMl.toFixed(2)} mL</strong> mark.
          </span>
        </div>
      </div>
    </div>
  );
};
