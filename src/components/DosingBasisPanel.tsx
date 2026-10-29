import React, { useState } from 'react';
import { Calculator, Droplets, Ruler, Scale } from 'lucide-react';
import { PediatricPatient } from '../data/pediatricPatients';
import { FormularyMedication } from '../data/clinicalFormulary';
import { MedicationList, PatientSafetyFacts } from './PatientPanel';

type VitalsUpdate = Partial<Pick<PediatricPatient, 'weightKg' | 'heightCm' | 'ageYears' | 'crClMlMin'>>;

interface DosingBasisPanelProps {
  patient: PediatricPatient;
  medication: FormularyMedication;
  bsaM2: number;
  onUpdateVitals: (patientId: string, updates: VitalsUpdate) => void;
}

type Role = 'driver' | 'feeds' | 'check' | 'none';
type AboutTab = 'profile' | 'current' | 'past';

const kidneyStatus = (crCl: number) =>
  crCl < 10
    ? { label: 'Severely reduced', className: 'bg-rose-100 text-rose-800' }
    : crCl <= 50
    ? { label: 'Reduced', className: 'bg-amber-100 text-amber-900' }
    : crCl < 90
    ? { label: 'Mildly reduced', className: 'bg-slate-100 text-slate-700' }
    : { label: 'Normal', className: 'bg-emerald-100 text-emerald-800' };

const Tile: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  role: Role;
  roleText?: string;
  warn?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ icon: Icon, label, role, roleText, warn, children, footer }) => (
  <div
    className={`relative rounded-xl border p-3 flex flex-col ${
      role === 'driver'
        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/60'
        : warn
        ? 'border-amber-300 bg-amber-50'
        : role === 'feeds'
        ? 'border-indigo-200 bg-white'
        : 'border-slate-200 bg-white'
    }`}
  >
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <Icon className={`w-3.5 h-3.5 ${role === 'driver' ? 'text-indigo-600' : 'text-slate-400'}`} />
      {label}
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-1">{children}</div>
    {roleText && (
      <div
        className={`mt-1.5 text-[11px] font-medium ${
          role === 'driver' ? 'text-indigo-700' : warn ? 'text-amber-800' : 'text-slate-400'
        }`}
      >
        {roleText}
      </div>
    )}
    {footer}
  </div>
);

const BigInput: React.FC<{
  value: number;
  step: number;
  min: number;
  max: number;
  label: string;
  onChange: (raw: string) => void;
}> = ({ value, step, min, max, label, onChange }) => (
  <input
    type="number"
    aria-label={label}
    value={value}
    step={step}
    min={min}
    max={max}
    onChange={(e) => onChange(e.target.value)}
    style={{ width: `${Math.max(2, String(value).length) + 1.5}ch` }}
    className="text-2xl font-semibold text-slate-900 bg-transparent rounded-md border border-transparent hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none px-1 -mx-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
  />
);

// Visual summary of the measurements a dose is derived from; the one the formula uses is highlighted
export const DosingBasisPanel: React.FC<DosingBasisPanelProps> = ({
  patient,
  medication,
  bsaM2,
  onUpdateVitals,
}) => {
  const byWeight = medication.dosingBasis === 'mg_per_kg_day';
  const byBsa = medication.dosingBasis === 'mg_per_m2_day' || medication.dosingBasis === 'mg_per_m2_dose';
  const renalChecked = !!medication.renalAdjustmentRule;
  const renalWarn = renalChecked && patient.crClMlMin <= 50;
  const kidney = kidneyStatus(patient.crClMlMin);
  const firstName = patient.shortName.split(' ')[0];
  const [tab, setTab] = useState<AboutTab>('profile');
  const currentMeds = patient.medications.filter((m) => m.status !== 'stopped');
  const pastMeds = patient.medications.filter((m) => m.status === 'stopped');
  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'current', label: `Current meds (${currentMeds.length})` },
    { id: 'past', label: `Past meds (${pastMeds.length})` },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          About {firstName}{' '}
          <span className="font-normal text-slate-500">
            · {byWeight ? 'this dose is calculated from weight' : byBsa ? 'this dose is calculated from body surface area' : 'fixed dose, not size-based'}
          </span>
        </h3>
      </div>

      <div role="tablist" aria-label={`About ${firstName}`} className="flex gap-1 mb-3 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 -mb-px px-2.5 py-1.5 text-xs font-medium text-center border-b-2 cursor-pointer whitespace-nowrap ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
          <Tile
            icon={Scale}
            label="Weight"
            role={byWeight ? 'driver' : byBsa ? 'feeds' : 'none'}
            roleText={byWeight ? '● Dose is calculated from this' : byBsa ? 'Used to work out BSA' : undefined}
          >
            <BigInput
              label="Weight in kg"
              value={patient.weightKg}
              step={0.5}
              min={2}
              max={120}
              onChange={(v) => onUpdateVitals(patient.id, { weightKg: Math.max(1, parseFloat(v) || 1) })}
            />
            <span className="text-sm text-slate-500">kg</span>
          </Tile>

          <Tile
            icon={Ruler}
            label="Height"
            role={byBsa ? 'feeds' : 'none'}
            roleText={byBsa ? 'Used to work out BSA' : undefined}
          >
            <BigInput
              label="Height in cm"
              value={patient.heightCm}
              step={1}
              min={40}
              max={210}
              onChange={(v) => onUpdateVitals(patient.id, { heightCm: Math.max(30, parseFloat(v) || 30) })}
            />
            <span className="text-sm text-slate-500">cm</span>
          </Tile>

          <Tile
            icon={Calculator}
            label="Body surface area"
            role={byBsa ? 'driver' : 'none'}
            roleText={byBsa ? '● Dose is calculated from this' : 'Auto-calculated (Mosteller)'}
          >
            <span
              className="text-2xl font-semibold text-slate-900"
              title="Mosteller: √((height cm × weight kg) / 3600)"
            >
              {bsaM2.toFixed(2)}
            </span>
            <span className="text-sm text-slate-500">m²</span>
          </Tile>

          <Tile
            icon={Droplets}
            label="Kidney function (CrCl)"
            role={renalChecked ? 'check' : 'none'}
            warn={renalWarn}
            roleText={
              renalWarn
                ? 'Low — dosing interval is adjusted'
                : renalChecked
                ? 'Checked for this drug'
                : 'Not used for this drug'
            }
            footer={
              // Simple gauge: 0–150 mL/min with the ≤50 adjustment zone shaded
              <div className="mt-2 relative h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden>
                <div className="absolute inset-y-0 left-0 w-1/3 bg-amber-200" />
                <div
                  className={`absolute top-0 bottom-0 w-1.5 rounded-full ${renalWarn ? 'bg-amber-600' : 'bg-slate-700'}`}
                  style={{ left: `calc(${Math.min(100, (patient.crClMlMin / 150) * 100)}% - 3px)` }}
                />
              </div>
            }
          >
            <BigInput
              label="Creatinine clearance in mL/min"
              value={patient.crClMlMin}
              step={1}
              min={5}
              max={160}
              onChange={(v) => onUpdateVitals(patient.id, { crClMlMin: Math.max(5, parseInt(v, 10) || 5) })}
            />
            <span className="text-sm text-slate-500">mL/min</span>
            <span className={`self-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${kidney.className}`}>
              {kidney.label}
            </span>
          </Tile>
        </div>
      )}

      {tab === 'current' && <MedicationList meds={currentMeds} emptyText="No current medicines recorded" />}
      {tab === 'past' && <MedicationList meds={pastMeds} emptyText="No past medicines recorded" />}

      {/* Facts that change what can be prescribed or how it's given */}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        <PatientSafetyFacts patient={patient} compact />
      </div>

    </section>
  );
};
