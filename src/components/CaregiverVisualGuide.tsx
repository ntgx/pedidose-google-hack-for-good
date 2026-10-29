import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Hospital, PlayCircle, X, XCircle } from 'lucide-react';
import { PediatricPatient } from '../data/pediatricPatients';
import { FormularyFormulation } from '../data/clinicalFormulary';
import { Card, SectionTitle } from './ui';

interface CaregiverVisualGuideProps {
  patient: PediatricPatient;
  formulation: FormularyFormulation;
  /** Volume per dose for liquids; null for solid units */
  volumeMl: number | null;
  unitsPerAdministration: number;
  doseMg: number;
}

// "1 tablet", "½ tablet", "1½ capsules", "0.73 tablet" — exact amounts are never rounded
export const formatUnits = (n: number, form: FormularyFormulation['form']) => {
  const noun = form === 'capsule' ? 'capsule' : 'tablet';
  const whole = Math.floor(n);
  const amount = n - whole === 0.5 ? `${whole || ''}½` : `${n}`;
  return `${amount} ${noun}${n > 1 ? 's' : ''}`;
};

// Where on the body each formulation goes; the whole-body figure highlights it
type BodySite = 'mouth' | 'central_line';

const BODY_SITES: Record<BodySite, { x: number; y: number; label: string; color: string }> = {
  mouth: { x: 60, y: 45, label: 'By mouth', color: '#059669' },
  central_line: { x: 47, y: 80, label: 'Chest port (IV)', color: '#6d28d9' },
};

const siteForForm = (form: FormularyFormulation['form']): BodySite =>
  form === 'iv_solution' ? 'central_line' : 'mouth';

const SKIN = '#fde4cf';

// Hospital-produced caregiver videos (all allow embedding); one is picked at random per click
const VIDEOS = {
  liquid: [
    'U0og-yXmiUY', // Cincinnati Children's: How to give your child liquid medication
    'ChjU39X58OE', // Sydney Children's Hospitals Network: Giving medication to a baby or child
    'j0wBWoC44Kw', // Dana-Farber: Using the right oral syringe and giving the correct amount
  ],
  crushed: [
    'xtRv_HgUzI0', // SickKids AboutKidsHealth: How to give tablets to babies
    'qPhERFsxD6k', // Boston Children's: Liquids, chewables and pills
  ],
  tablet: [
    '37ZRkenMDxE', // Johns Hopkins All Children's: Teaching children how to swallow a pill
    'i-LqyrtaJDc', // Phoenix Children's: Teaching children to swallow pills
    'mQol1fQmHJU', // Cook Children's: Teach your child to swallow a pill
  ],
};

const randomVideo = (kind: keyof typeof VIDEOS, exclude?: string) => {
  const pool = VIDEOS[kind].filter((id) => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
};

// Whole child, front view, with a pulsing marker on the administration site
const BodyMap: React.FC<{ site: BodySite }> = ({ site }) => {
  const { x, y, label, color } = BODY_SITES[site];
  return (
    <svg viewBox="0 0 120 270" className="w-full max-w-[120px] h-auto mx-auto" role="img"
      aria-label={`Whole body: give the medicine ${label.toLowerCase()}`}>
      {/* Arms */}
      <line x1="38" y1="72" x2="22" y2="140" stroke={SKIN} strokeWidth="13" strokeLinecap="round" />
      <line x1="82" y1="72" x2="98" y2="140" stroke={SKIN} strokeWidth="13" strokeLinecap="round" />
      <line x1="38" y1="72" x2="32" y2="96" stroke="#bae6fd" strokeWidth="15" strokeLinecap="round" />
      <line x1="82" y1="72" x2="88" y2="96" stroke="#bae6fd" strokeWidth="15" strokeLinecap="round" />
      {/* Legs and feet */}
      <line x1="45" y1="168" x2="43" y2="242" stroke={SKIN} strokeWidth="17" strokeLinecap="round" />
      <line x1="75" y1="168" x2="77" y2="242" stroke={SKIN} strokeWidth="17" strokeLinecap="round" />
      <ellipse cx="40" cy="250" rx="12" ry="6" fill="#475569" />
      <ellipse cx="80" cy="250" rx="12" ry="6" fill="#475569" />
      {/* Shirt and shorts */}
      <rect x="54" y="54" width="12" height="12" fill={SKIN} />
      <path d="M 34 68 Q 60 60 86 68 L 88 140 L 32 140 Z" fill="#bae6fd" />
      <path d="M 32 138 L 88 138 L 90 176 L 63 176 L 60 162 L 57 176 L 30 176 Z" fill="#cbd5e1" />
      {/* Head */}
      <circle cx="60" cy="34" r="24" fill={SKIN} />
      <path d="M 36 32 Q 38 8 60 8 Q 82 8 84 32 Q 72 18 60 18 Q 48 18 36 32 Z" fill="#78350f" opacity="0.85" />
      <circle cx="51" cy="33" r="2.5" fill="#1e293b" />
      <circle cx="69" cy="33" r="2.5" fill="#1e293b" />
      <path d="M 54 44 Q 60 48 66 44" stroke="#9f1239" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Administration site */}
      <circle cx={x} cy={y} r="11" fill={color} opacity="0.25" className="motion-safe:animate-pulse" />
      <circle cx={x} cy={y} r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <text x="60" y="268" fontSize="11" fontWeight="700" fill={color} textAnchor="middle">{label}</text>
    </svg>
  );
};

// Static, read-only syringe for parents: shows exactly where the black ring must sit
const DoseSyringe: React.FC<{ volumeMl: number }> = ({ volumeMl }) => {
  const sizeMl = volumeMl <= 1 ? 1 : volumeMl <= 5 ? 5 : volumeMl <= 10 ? 10 : Math.ceil(volumeMl / 10) * 10;
  const BX = 50;
  const BW = 300;
  const xAt = (v: number) => BX + (BW * Math.min(v, sizeMl)) / sizeMl;
  const ringX = xAt(volumeMl);
  // Minor tick every 1/50 of the barrel, major every 1/10, label every 1/5
  const ticks = Array.from({ length: 51 }, (_, i) => i);

  return (
    <svg viewBox="0 0 420 130" className="w-full h-auto" role="img"
      aria-label={`${sizeMl} mL oral syringe filled to ${volumeMl.toFixed(2)} mL`}>
      {/* Callout: read the dose at the tip-side edge of the black ring */}
      <text x={Math.min(330, Math.max(60, ringX))} y="14" fontSize="13" fontWeight="700" fill="#0f766e" textAnchor="middle">
        {volumeMl.toFixed(2)} mL
      </text>
      <path d={`M ${ringX} 20 L ${ringX} 34 M ${ringX - 5} 28 L ${ringX} 34 L ${ringX + 5} 28`}
        stroke="#0f766e" strokeWidth="2" fill="none" />

      {/* EnFit tip */}
      <rect x="18" y="58" width="32" height="18" rx="3" fill="#7e22ce" stroke="#581c87" strokeWidth="1.5" />

      {/* Barrel + drawn-up liquid */}
      <rect x={BX} y="38" width={BW} height="58" rx="4" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
      <rect x={BX + 1} y="39" width={Math.max(0, ringX - BX - 1)} height="56" fill="rgba(13, 148, 136, 0.35)" />

      {ticks.map((i) => {
        const x = BX + (BW * i) / 50;
        const major = i % 5 === 0;
        const label = i % 10 === 0;
        return (
          <g key={i}>
            <line x1={x} y1={major ? 78 : 86} x2={x} y2="96" stroke="#334155" strokeWidth={major ? 1.5 : 0.75} />
            {label && (
              <text x={x} y="112" fontSize="10" fontWeight="600" fill="#334155" fontFamily="monospace" textAnchor="middle">
                {((sizeMl * i) / 50).toFixed(sizeMl <= 1 ? 1 : 0)}
              </text>
            )}
          </g>
        );
      })}
      <text x={BX + BW + 16} y="112" fontSize="10" fontWeight="700" fill="#475569">mL</text>

      {/* Black rubber ring, rod and thumb press */}
      <rect x={ringX} y="39" width="9" height="56" rx="2" fill="#0f172a" />
      <line x1={ringX} y1="36" x2={ringX} y2="98" stroke="#14b8a6" strokeWidth="2.5" />
      <rect x={ringX + 9} y="58" width={Math.max(30, 380 - ringX - 9)} height="18" fill="#9333ea" opacity="0.85" />
      <rect x={Math.max(ringX + 39, 380)} y="38" width="12" height="58" rx="3" fill="#6b21a8" />

      <text x="210" y="128" fontSize="10" fill="#64748b" textAnchor="middle">
        {sizeMl} mL syringe · line up the tip-side edge of the black ring with the mark
      </text>
    </svg>
  );
};

const Tablets: React.FC<{ count: number; capsule: boolean }> = ({ count, capsule }) => {
  const whole = Math.floor(count);
  const frac = count - whole;
  const half = frac === 0.5;
  // Any other fraction is drawn as a dashed outline; the exact amount is in the label
  const partial = frac > 0 && !half;
  const n = whole + (frac > 0 ? 1 : 0);
  return (
    <svg viewBox={`0 0 ${Math.max(1, n) * 70 + 10} 70`} className="h-20 w-auto" role="img"
      aria-label={formatUnits(count, capsule ? 'capsule' : 'tablet')}>
      {Array.from({ length: n }, (_, i) => {
        const cx = 40 + i * 70;
        const isHalf = half && i === n - 1;
        if (partial && i === n - 1) {
          return (
            <circle key={i} cx={cx} cy="35" r="27" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" />
          );
        }
        if (capsule) {
          return (
            <g key={i} transform={`rotate(-25 ${cx} 35)`}>
              <rect x={cx - 26} y="23" width="26" height="24" rx="12" fill="#f43f5e" />
              <rect x={cx} y="23" width="26" height="24" rx="12" fill="#fde68a" />
              <rect x={cx - 13} y="23" width="26" height="24" fill="#f43f5e" />
              <rect x={cx} y="23" width="13" height="24" fill="#fde68a" />
            </g>
          );
        }
        return isHalf ? (
          <path key={i} d={`M ${cx} 8 A 27 27 0 0 0 ${cx} 62 Z`} fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
        ) : (
          <g key={i}>
            <circle cx={cx} cy="35" r="27" fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
            <line x1={cx} y1="14" x2={cx} y2="56" stroke="#94a3b8" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
};

// Front view of a child's face with the open mouth; marks where to aim and where not to
const MouthDiagram: React.FC<{ target: 'cheek' | 'tongue' }> = ({ target }) => (
  <svg viewBox="0 0 260 230" className="w-full max-w-[280px] h-auto mx-auto" role="img"
    aria-label={target === 'cheek'
      ? 'Aim the syringe tip into the cheek pocket, between gum and cheek, not into the back of the throat'
      : 'Place the tablet on the middle of the tongue, then give a drink of water'}>
    {/* Head */}
    <ellipse cx="130" cy="110" rx="82" ry="92" fill="#fde4cf" stroke="#c2410c" strokeOpacity="0.35" strokeWidth="2" />
    <path d="M 52 90 Q 60 22 130 18 Q 200 22 208 90 Q 180 52 130 50 Q 80 52 52 90 Z" fill="#78350f" opacity="0.85" />
    <circle cx="100" cy="98" r="6" fill="#1e293b" />
    <circle cx="160" cy="98" r="6" fill="#1e293b" />
    <path d="M 126 112 Q 130 128 136 124" stroke="#c2410c" strokeOpacity="0.5" strokeWidth="2" fill="none" />

    {/* Open mouth: gums, back of throat, tongue */}
    <ellipse cx="130" cy="160" rx="38" ry="22" fill="#7f1d1d" />
    <ellipse cx="130" cy="157" rx="9" ry="6" fill="#450a0a" />
    <ellipse cx="130" cy="171" rx="26" ry="10" fill="#f9a8d4" />
    <path d="M 98 148 Q 130 138 162 148" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />

    {/* Never into the throat */}
    <g>
      <circle cx="130" cy="157" r="8" fill="none" stroke="#e11d48" strokeWidth="2" />
      <path d="M 125 152 L 135 162 M 135 152 L 125 162" stroke="#e11d48" strokeWidth="2" />
      <line x1="138" y1="160" x2="214" y2="196" stroke="#e11d48" strokeWidth="1.5" />
      <text x="214" y="210" fontSize="11" fontWeight="700" fill="#be123c" textAnchor="middle">Not the throat</text>
    </g>

    {target === 'cheek' ? (
      <g>
        {/* Cheek pocket target on the child's right side + syringe coming in from the side */}
        <circle cx="98" cy="162" r="11" fill="rgba(16,185,129,0.25)" stroke="#059669" strokeWidth="2.5" strokeDasharray="4 2" />
        <g transform="rotate(-18 98 162)">
          <rect x="12" y="155" width="70" height="14" rx="3" fill="#ede9fe" stroke="#7e22ce" strokeWidth="1.5" />
          <rect x="82" y="158" width="14" height="8" rx="2" fill="#7e22ce" />
          <rect x="2" y="152" width="8" height="20" rx="2" fill="#6b21a8" />
        </g>
        <line x1="92" y1="172" x2="56" y2="200" stroke="#059669" strokeWidth="1.5" />
        <text x="50" y="214" fontSize="11" fontWeight="700" fill="#047857" textAnchor="middle">Cheek pocket</text>
        <text x="50" y="226" fontSize="9" fill="#047857" textAnchor="middle">gum ↔ cheek</text>
      </g>
    ) : (
      <g>
        <circle cx="130" cy="172" r="9" fill="rgba(16,185,129,0.3)" stroke="#059669" strokeWidth="2.5" />
        <circle cx="130" cy="172" r="4" fill="#f1f5f9" stroke="#64748b" />
        <line x1="121" y1="178" x2="56" y2="200" stroke="#059669" strokeWidth="1.5" />
        <text x="50" y="214" fontSize="11" fontWeight="700" fill="#047857" textAnchor="middle">Middle of tongue</text>
        <text x="50" y="226" fontSize="9" fill="#047857" textAnchor="middle">then a drink</text>
      </g>
    )}
  </svg>
);

// Child torso showing a central line port — IV doses are given in hospital only
const CentralLineDiagram: React.FC = () => (
  <svg viewBox="0 0 260 230" className="w-full max-w-[280px] h-auto mx-auto" role="img"
    aria-label="IV dose goes into the central line port on the upper chest, given by the hospital nurse only">
    <circle cx="130" cy="44" r="32" fill="#fde4cf" stroke="#c2410c" strokeOpacity="0.35" strokeWidth="2" />
    <path d="M 70 230 L 70 120 Q 70 88 104 84 L 156 84 Q 190 88 190 120 L 190 230 Z"
      fill="#e0f2fe" stroke="#0369a1" strokeOpacity="0.4" strokeWidth="2" />
    {/* Line from port up into the vein */}
    <path d="M 108 128 Q 110 100 122 86" stroke="#7c3aed" strokeWidth="2.5" fill="none" strokeDasharray="4 3" />
    <circle cx="106" cy="132" r="9" fill="#c4b5fd" stroke="#6d28d9" strokeWidth="2.5" />
    <line x1="97" y1="134" x2="40" y2="150" stroke="#6d28d9" strokeWidth="1.5" />
    <text x="4" y="164" fontSize="11" fontWeight="700" fill="#5b21b6">Port / central line</text>
    <text x="4" y="176" fontSize="9" fill="#5b21b6">nurse only</text>
    {/* Spine: never */}
    <g>
      <line x1="130" y1="150" x2="130" y2="225" stroke="#e11d48" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M 158 180 L 174 196 M 174 180 L 158 196" stroke="#e11d48" strokeWidth="3" />
      <text x="256" y="214" fontSize="11" fontWeight="700" fill="#be123c" textAnchor="end">Never in the spine</text>
    </g>
  </svg>
);

const StepRow: React.FC<{ steps: Array<{ title: string; text: string }> }> = ({ steps }) => (
  <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    {steps.map((s, i) => (
      <li key={i} className="flex gap-2 rounded-lg bg-slate-50 p-2.5">
        <span className="w-5 h-5 shrink-0 rounded-full bg-teal-700 text-white text-[11px] flex items-center justify-center">
          {i + 1}
        </span>
        <div>
          <div className="text-sm font-medium text-slate-900">{s.title}</div>
          <div className="text-xs text-slate-600 leading-snug">{s.text}</div>
        </div>
      </li>
    ))}
  </ol>
);

export const CaregiverVisualGuide: React.FC<CaregiverVisualGuideProps> = ({
  patient,
  formulation,
  volumeMl,
  unitsPerAdministration,
  doseMg,
}) => {
  const [videoId, setVideoId] = useState<string | null>(null);

  if (formulation.form === 'iv_solution') {
    return (
      <Card className="space-y-3">
        <SectionTitle title="Where this dose is given" hint="This medicine is not given at home" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="grid grid-cols-[minmax(80px,120px)_1fr] gap-3 items-center">
            <BodyMap site="central_line" />
            <CentralLineDiagram />
          </div>
          <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
            <p className="flex items-start gap-2">
              <Hospital className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
              Given by the oncology nurse at the hospital, through {patient.shortName}’s port or central line.
            </p>
            <p className="flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
              Into the vein only — never into the spine (fatal). You don’t need to measure or give anything.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" />
              At home: keep the port dressing clean and dry, and call the team about fever, jaw pain or constipation.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const isLiquid = volumeMl !== null;
  const isCapsule = formulation.form === 'capsule';
  const crushed = !isLiquid && patient.swallowingStatus !== 'can_swallow_tablets';
  const videoKind = isLiquid ? 'liquid' : crushed ? 'crushed' : 'tablet';

  const steps = isLiquid
    ? [
        { title: 'Sit upright', text: 'Hold your child sitting up or at least half-upright — never lying flat.' },
        { title: 'Tip into the cheek', text: 'Slide the tip between gum and cheek, toward the back teeth.' },
        { title: 'Push slowly', text: 'Small squirts; let them swallow between each one. Then give a drink.' },
      ]
    : crushed
    ? [
        { title: 'Check first', text: 'Only crush or open if the formulation card allows it.' },
        { title: 'Mix in 1 teaspoon', text: 'Cold apple purée or yoghurt — never a full bowl or bottle.' },
        { title: 'Give it all', text: 'Sitting upright, spoon in, then a drink to wash it down.' },
      ]
    : [
        { title: 'Sit upright', text: 'Sitting up straight makes swallowing easier and safer.' },
        { title: 'On the tongue', text: 'Place it on the middle of the tongue — not at the back.' },
        { title: 'Big sip of water', text: 'Swallow with water, chin slightly down. Don’t chew.' },
      ];

  return (
    <Card className="space-y-4">
      <SectionTitle
        title="How to give it"
        action={
          <button
            type="button"
            onClick={() => setVideoId(videoId ? null : randomVideo(videoKind))}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {videoId ? <X className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5 text-rose-600" />}
            {videoId ? 'Close video' : 'Play video'}
          </button>
        }
      />
      {videoId && (
        <div className="space-y-1.5">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
            <iframe
              key={videoId}
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title="How to give medicine video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          {VIDEOS[videoKind].length > 1 && (
            <button
              type="button"
              onClick={() => setVideoId(randomVideo(videoKind, videoId))}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Show another video
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-medium text-slate-900 mb-2">
            {isLiquid ? '1. Fill the syringe to this line' : `1. Take ${formatUnits(unitsPerAdministration, formulation.form)}`}
          </div>
          {isLiquid ? (
            <>
              <DoseSyringe volumeMl={volumeMl} />
              <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                Not {(volumeMl * 10).toFixed(1)} mL — check the decimal point every time.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <Tablets count={unitsPerAdministration} capsule={isCapsule} />
              <span className="text-[11px] text-slate-500">= {doseMg.toFixed(1)} mg per dose</span>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-medium text-slate-900 mb-2">
            2. {isLiquid ? 'Aim for the cheek pocket' : crushed ? 'Spoon onto the tongue' : 'Place on the tongue'}
          </div>
          <div className="grid grid-cols-[minmax(80px,120px)_1fr] gap-3 items-center">
            <BodyMap site={siteForForm(formulation.form)} />
            <MouthDiagram target={isLiquid ? 'cheek' : 'tongue'} />
          </div>
        </div>
      </div>
      <StepRow steps={steps} />
    </Card>
  );
};
