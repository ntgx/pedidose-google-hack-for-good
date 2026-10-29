import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck } from 'lucide-react';
import { ClinicalRole } from '../api/uhmepClient';
import { PediatricPatient } from '../data/pediatricPatients';
import { ROLE_CONFIG } from './HeaderRoleSwitcher';
import { Badge, Button } from './ui';

interface OnboardingFlowProps {
  patients: PediatricPatient[];
  onComplete: (role: ClinicalRole, patientId: string) => void;
}

const STEPS = ['Your role', 'Patient'] as const;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  patients,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<ClinicalRole | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  const roleConfig = ROLE_CONFIG.find((r) => r.role === role);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-indigo-600 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-slate-900">PediDose</div>
          <div className="text-xs text-slate-500">Pediatric hemato-oncology safe prescribing</div>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Stepper */}
        <ol className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i < step
                    ? 'bg-teal-600 text-white'
                    : i === step
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={i === step ? 'font-medium text-slate-900' : 'text-slate-500'}>
                {label}
                {i === 0 && step > 0 && roleConfig && (
                  <span className="text-slate-400"> · {roleConfig.label}</span>
                )}
              </span>
              {i < STEPS.length - 1 && <span className="w-8 h-px bg-slate-200 ml-1" />}
            </li>
          ))}
        </ol>

        <div className="p-6">
          {step === 0 && (
            <>
              <h1 className="text-lg font-semibold text-slate-900">Who are you working as?</h1>
              <p className="text-sm text-slate-500 mt-1">
                Your role decides what you can do (sent as the <code className="font-mono">X-Role</code>{' '}
                header). You can switch any time from the top bar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                {ROLE_CONFIG.map((item) => {
                  const Icon = item.icon;
                  const selected = role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setRole(item.role)}
                      onDoubleClick={() => {
                        setRole(item.role);
                        setStep(1);
                      }}
                      className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.activeBg}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.person}</div>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mt-3">{item.description}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.landingHint}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-lg font-semibold text-slate-900">
                {role === 'patient' ? 'Whose medication are you managing?' : 'Which patient are you treating?'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Doses are calculated from this patient's weight, height and kidney function. You can switch
                patient from the top bar.
              </p>
              <div className="space-y-2.5 mt-5">
                {patients.map((p) => {
                  const selected = patientId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPatientId(p.id)}
                      onDoubleClick={() => role && onComplete(role, p.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {p.shortName}{' '}
                          <span className="font-normal text-slate-500">
                            · {p.ageYears}y · {p.weightKg} kg · {p.heightCm} cm
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">{p.ward}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{p.diagnosis}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.activeStudyId ? (
                          <Badge tone="trial">
                            <Lock className="w-3 h-3" />
                            Trial {p.activeStudyId}
                          </Badge>
                        ) : (
                          <Badge>{p.protocol}</Badge>
                        )}
                        {p.crClMlMin <= 50 && <Badge tone="warning">Reduced kidney function</Badge>}
                        {!p.allergies.some((a) => /none/i.test(a)) && (
                          <Badge tone="danger">Allergies: {p.allergies.join(', ')}</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          {step > 0 ? (
            <Button variant="ghost" size="md" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <Button variant="primary" size="md" disabled={!role} onClick={() => setStep(1)}>
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={!patientId}
              onClick={() => role && patientId && onComplete(role, patientId)}
            >
              Open PediDose
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
