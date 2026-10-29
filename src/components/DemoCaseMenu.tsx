import React, { useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { BenchmarkPreset } from '../data/clinicalFormulary';

interface DemoCaseMenuProps {
  presets: BenchmarkPreset[];
  activePresetId: string | null;
  onSelect: (preset: BenchmarkPreset) => void;
}

// Plain-language framing of each scripted case: the mistake it shows the app catching
const PLAIN_COPY: Record<string, { title: string; summary: string }> = {
  'case-1-hem-ismart': {
    title: 'Trial drug ordered from the wrong source',
    summary: 'Jane gets this drug free through a clinical trial. Ordering the shop-bought version is blocked.',
  },
  'case-2-posaconazole': {
    title: 'Formulation the family would pay for',
    summary: 'The liquid isn’t reimbursed for Jane. The app suggests the covered tablet and pre-fills the paperwork.',
  },
  'case-3-prednisolone-10x': {
    title: 'Decimal-point mistake on a syringe',
    summary: 'Toddler Marc needs 0.3 mL, but 3.0 mL was typed — ten times too much. The app stops it.',
  },
  'case-4-vincristine-cap': {
    title: 'Dose above the safe maximum',
    summary: 'The formula gives teenager Elena 2.49 mg of a chemo drug; the app caps it at the 2 mg safety limit.',
  },
  'case-5-aciclovir-renal': {
    title: 'Kidneys clearing the drug slowly',
    summary: 'Elena’s kidney function is reduced, so the app automatically spaces her antiviral doses further apart.',
  },
};

// Header dropdown that loads a scripted demo case (patient, medication, dose)
export const DemoCaseMenu: React.FC<DemoCaseMenuProps> = ({ presets, activePresetId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const active = presets.find((p) => p.id === activePresetId);
  const activeNumber = active ? active.badge.split(' •')[0] : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Load a demo case"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
          open ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        <Sparkles className="w-4 h-4 text-amber-300" />
        <span className="hidden sm:inline font-medium whitespace-nowrap">
          Demo<span>{activeNumber ? `: ${activeNumber}` : ''}</span>
        </span>
        <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[24rem] z-50 rounded-xl bg-white text-slate-900 shadow-xl border border-slate-200 p-1.5">
            <div className="px-2.5 pt-1.5 pb-2 text-xs text-slate-500">
              Each case loads a patient and a prescription containing a realistic mistake, so you can see the
              app catch it.
            </div>
            {presets.map((preset) => {
              const isActive = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSelect(preset);
                    setOpen(false);
                  }}
                  className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer ${
                    isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex-1 min-w-0" title={`${preset.title} — ${preset.subtitle}`}>
                    <span className="block text-[11px] font-medium text-indigo-700">{preset.badge.split(' •')[0]}</span>
                    <span className="block text-sm font-medium text-slate-900">
                      {PLAIN_COPY[preset.id]?.title ?? preset.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {PLAIN_COPY[preset.id]?.summary ?? preset.subtitle}
                    </span>
                  </span>
                  {isActive && <Check className="w-4 h-4 text-indigo-600 mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
