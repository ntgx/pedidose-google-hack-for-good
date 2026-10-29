import React, { useMemo, useRef, useState } from 'react';
import { PediatricPatient } from '../data/pediatricPatients';
import { FormularyFormulation, FormularyMedication } from '../data/clinicalFormulary';
import { calculateDeterministicDose } from '../utils/dosingCalculator';

interface DoseCeilingChartProps {
  patient: PediatricPatient;
  medication: FormularyMedication;
  formulation: FormularyFormulation;
  dosePerUnit: number;
  frequencyPerDay: number;
}

// Chart tokens: "given" is the one identity hue; the raw formula is a neutral reference line,
// identified by its dash, legend entry and direct label (validated: CVD ΔE 17.8, contrast ≥ 3:1)
const GIVEN = '#4f46e5';
const RAW = '#64748b';
const GRID = '#e2e8f0';
const INK_MUTED = '#64748b';

const W = 640;
const H = 220;
const M = { top: 16, right: 92, bottom: 34, left: 44 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const niceStep = (span: number, target: number) => {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
};
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

// How the daily dose would change with weight (height fixed), showing where the safety ceiling takes over
export const DoseCeilingChart: React.FC<DoseCeilingChartProps> = ({
  patient,
  medication,
  formulation,
  dosePerUnit,
  frequencyPerDay,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const firstName = patient.shortName.split(' ')[0];
  const ceiling = medication.maxDailyDoseMg ?? (medication.maxSingleDoseMg ? medication.maxSingleDoseMg * frequencyPerDay : null);
  const usesHeight = medication.dosingBasis !== 'mg_per_kg_day';

  const { points, lo, hi, crossing } = useMemo(() => {
    const at = (weightKg: number) => {
      const c = calculateDeterministicDose({
        patient: { ...patient, weightKg },
        medication,
        formulation,
        dosePerUnit,
        frequencyPerDay,
        durationDays: 1,
      });
      return { weight: weightKg, raw: c.rawDailyDoseMg, given: c.renalAdjustedDailyDoseMg, capped: c.isHardCapped };
    };
    // Find where the ceiling starts to bite so the range always shows it (when it's within 120 kg)
    let cross: number | null = null;
    for (let w = 2; w <= 120; w += 0.5) {
      if (at(w).capped) {
        cross = w;
        break;
      }
    }
    const lo = Math.max(2, Math.floor(patient.weightKg * 0.4));
    const hi = Math.min(120, Math.ceil(Math.max(patient.weightKg * 1.8, cross ? cross * 1.35 : 0)));
    const n = 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => at(Math.round((lo + ((hi - lo) * i) / n) * 10) / 10));
    return { points: pts, lo, hi, crossing: cross };
  }, [patient, medication, formulation, dosePerUnit, frequencyPerDay]);

  const current = calculateDeterministicDose({
    patient,
    medication,
    formulation,
    dosePerUnit,
    frequencyPerDay,
    durationDays: 1,
  });

  const yMax = Math.max(...points.map((p) => p.raw), current.rawDailyDoseMg, ceiling ?? 0) * 1.08 || 1;
  const x = (w: number) => M.left + ((w - lo) / (hi - lo)) * PW;
  const y = (mg: number) => M.top + PH - (mg / yMax) * PH;
  const path = (key: 'raw' | 'given') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.weight).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const yStep = niceStep(yMax, 4);
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const xStep = niceStep(hi - lo, 8);
  const xTicks: number[] = [];
  for (let t = Math.ceil(lo / xStep) * xStep; t <= hi; t += xStep) xTicks.push(Math.round(t * 10) / 10);

  const last = points[points.length - 1];
  const rawLabelY = y(last.raw);
  const givenLabelY = Math.abs(y(last.given) - rawLabelY) < 14 ? y(last.given) + 14 : y(last.given);
  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const diverges = points.some((p) => p.raw - p.given > 0.005);

  // Ticks use the precision of their step, so 1500 reads "1500" and 0.5 reads "0.5"
  const tickDecimals = yStep >= 1 ? 0 : yStep >= 0.1 ? 1 : 2;

  // A straight line with no ceiling in range and nothing lowering the dose tells the prescriber nothing
  if (!crossing && !diverges) return null;

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const w = lo + ((local.x - M.left) / PW) * (hi - lo);
    if (w < lo || w > hi) return setHoverIdx(null);
    setHoverIdx(Math.round(((w - lo) / (hi - lo)) * (points.length - 1)));
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-slate-900">How this dose changes with weight</h4>
          <p className="text-xs text-slate-500">
            mg per day at {dosePerUnit} {medication.doseUnitLabel}
            {usesHeight ? `, keeping ${firstName}’s height of ${patient.heightCm} cm` : ''}.{' '}
            {ceiling !== null &&
              (crossing
                ? `The ${fmt(ceiling)} mg/day maximum takes over from ${crossing} kg.`
                : `The ${fmt(ceiling)} mg/day maximum isn’t reached below 120 kg.`)}
            {current.isRenalAdjusted &&
              ` The dose given is below the formula because ${firstName}’s kidney function is reduced (fewer doses a day).`}
          </p>
        </div>
        {/* Legend — always present for two series */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden>
              <line x1="0" y1="4" x2="18" y2="4" stroke={GIVEN} strokeWidth="2" />
            </svg>
            Dose given
          </span>
          {diverges && (
            <span className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke={RAW} strokeWidth="2" strokeDasharray="4 3" />
              </svg>
              Formula before limits
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label={`Daily dose against weight. At ${patient.weightKg} kg, ${firstName} gets ${fmt(current.renalAdjustedDailyDoseMg)} mg a day${current.isHardCapped ? `; the formula would give ${fmt(current.rawDailyDoseMg)} mg` : ''}.`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {/* Recessive grid & axes */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + PW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={M.left - 6} y={y(t) + 3.5} fontSize="10" fill={INK_MUTED} textAnchor="end">
                {t.toFixed(tickDecimals)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={M.top + PH + 14} fontSize="10" fill={INK_MUTED} textAnchor="middle">
              {t}
            </text>
          ))}
          <text x={M.left + PW / 2} y={H - 4} fontSize="10" fill={INK_MUTED} textAnchor="middle">
            Weight (kg)
          </text>
          <text x={10} y={M.top + PH / 2} fontSize="10" fill={INK_MUTED} textAnchor="middle" transform={`rotate(-90 10 ${M.top + PH / 2})`}>
            mg / day
          </text>

          {/* Series: raw formula (dashed reference) and the dose actually given */}
          {diverges && <path d={path('raw')} fill="none" stroke={RAW} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />}
          <path d={path('given')} fill="none" stroke={GIVEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Direct labels at the line ends */}
          {diverges && (
            <text x={M.left + PW + 6} y={rawLabelY + 3.5} fontSize="10" fill={INK_MUTED}>
              Formula
            </text>
          )}
          <text x={M.left + PW + 6} y={givenLabelY + 3.5} fontSize="10" fill="#334155" fontWeight="600">
            Given
          </text>

          {/* This patient */}
          {patient.weightKg >= lo && patient.weightKg <= hi && (
            <g>
              <line x1={x(patient.weightKg)} x2={x(patient.weightKg)} y1={M.top} y2={M.top + PH} stroke="#cbd5e1" strokeWidth="1" />
              {current.isHardCapped && (
                <circle cx={x(patient.weightKg)} cy={y(current.rawDailyDoseMg)} r="4" fill="#fff" stroke={RAW} strokeWidth="2" />
              )}
              <circle cx={x(patient.weightKg)} cy={y(current.renalAdjustedDailyDoseMg)} r="5" fill={GIVEN} stroke="#fff" strokeWidth="2" />
              <text
                x={x(patient.weightKg) + (x(patient.weightKg) > M.left + PW * 0.7 ? -8 : 8)}
                y={Math.max(M.top + 10, y(current.renalAdjustedDailyDoseMg) - 9)}
                fontSize="10"
                fontWeight="600"
                fill="#1e293b"
                textAnchor={x(patient.weightKg) > M.left + PW * 0.7 ? 'end' : 'start'}
              >
                {firstName} · {patient.weightKg} kg → {fmt(current.renalAdjustedDailyDoseMg)} mg
              </text>
            </g>
          )}

          {/* Hover crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover.weight)} x2={x(hover.weight)} y1={M.top} y2={M.top + PH} stroke="#94a3b8" strokeWidth="1" />
              {diverges && <circle cx={x(hover.weight)} cy={y(hover.raw)} r="4" fill="#fff" stroke={RAW} strokeWidth="2" />}
              <circle cx={x(hover.weight)} cy={y(hover.given)} r="4" fill={GIVEN} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md bg-slate-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{
              left: `${(x(hover.weight) / W) * 100}%`,
              transform: x(hover.weight) > W * 0.6 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <div className="font-medium">{hover.weight} kg</div>
            <div>Given: {fmt(hover.given)} mg/day</div>
            {hover.raw - hover.given > 0.005 && (
              <div className="text-slate-300">Formula: {fmt(hover.raw)} mg/day (capped)</div>
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
              <th className="font-medium py-1">Weight</th>
              <th className="font-medium py-1">Formula (mg/day)</th>
              <th className="font-medium py-1">Given (mg/day)</th>
            </tr>
          </thead>
          <tbody className="font-mono text-slate-700">
            {points.filter((_, i) => i % 6 === 0).map((p) => (
              <tr key={p.weight} className="border-t border-slate-100">
                <td className="py-1">{p.weight} kg</td>
                <td className="py-1">{fmt(p.raw)}</td>
                <td className="py-1">{fmt(p.given)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};
