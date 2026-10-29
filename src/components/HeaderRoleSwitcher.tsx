import React, { useState } from 'react';
import {
  ChevronDown,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  FlaskConical,
  HeartHandshake,
  Terminal,
} from 'lucide-react';
import { ClinicalRole } from '../api/uhmepClient';

export interface HeaderTab<T extends string> {
  id: T;
  label: string;
  icon: React.FC<{ className?: string }>;
  count?: number;
  countTitle?: string;
}

interface HeaderRoleSwitcherProps<T extends string> {
  tabs: HeaderTab<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  activeRole: ClinicalRole;
  onSelectRole: (role: ClinicalRole) => void;
  demoControl: React.ReactNode;
  patientControl: React.ReactNode;
  serverOnline: boolean;
  lastCorrelationId: string;
  onResetFixtures: () => void;
  isResetting: boolean;
  onToggleTelemetry: () => void;
  telemetryOpen: boolean;
  exchangeCount: number;
}

export const ROLE_CONFIG: Array<{
  role: ClinicalRole;
  label: string;
  person: string;
  description: string;
  landingHint: string;
  activeBg: string;
  dot: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    role: 'assistant',
    label: 'Assistant',
    person: 'Dr. Peeters',
    description: 'Drafts prescriptions',
    landingHint: 'Uses Prescribe and Orders',
    activeBg: 'bg-amber-500 text-white',
    dot: 'bg-amber-400',
    icon: Stethoscope,
  },
  {
    role: 'supervisor',
    label: 'Supervisor',
    person: 'Prof. Janssens',
    description: 'Co-signs drafts ($approve)',
    landingHint: 'Uses Orders (to co-sign) and Prescribe',
    activeBg: 'bg-indigo-500 text-white',
    dot: 'bg-indigo-400',
    icon: UserCheck,
  },
  {
    role: 'pharmacist',
    label: 'Pharmacist',
    person: 'Apr. Vanacker',
    description: 'Dispenses, manages trial locks & moderates tips',
    landingHint: 'Uses Orders and Caregiver (to review tips)',
    activeBg: 'bg-emerald-500 text-white',
    dot: 'bg-emerald-400',
    icon: FlaskConical,
  },
  {
    role: 'patient',
    label: 'Caregiver',
    person: 'Parent',
    description: 'Home companion & tips',
    landingHint: 'Uses the Caregiver companion',
    activeBg: 'bg-rose-500 text-white',
    dot: 'bg-rose-400',
    icon: HeartHandshake,
  },
];

// Compact dark dropdown: a transparent native <select> over a styled label keeps it accessible
const HeaderSelect: React.FC<{
  icon: React.ReactNode;
  display: React.ReactNode;
  title: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ icon, display, title, value, onChange, children }) => (
  <label
    title={title}
    className="relative flex items-center gap-1 sm:gap-1.5 pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 py-1.5 rounded-md text-sm text-slate-200 hover:bg-slate-800 cursor-pointer"
  >
    {icon}
    <span className="font-medium whitespace-nowrap truncate max-w-[8.5rem] sm:max-w-none">{display}</span>
    <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-500" />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={title}
      className="absolute inset-0 opacity-0 cursor-pointer"
    >
      {children}
    </select>
  </label>
);

export function HeaderRoleSwitcher<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  activeRole,
  onSelectRole,
  demoControl,
  patientControl,
  serverOnline,
  lastCorrelationId,
  onResetFixtures,
  isResetting,
  onToggleTelemetry,
  telemetryOpen,
  exchangeCount,
}: HeaderRoleSwitcherProps<T>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = ROLE_CONFIG.find((r) => r.role === activeRole)!;

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-x-2 md:gap-x-6">
        <div className="hidden sm:flex items-center gap-2 py-3" title="PediDose — UHMEP v1.4 · Recip-e FHIR R4">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-teal-400 to-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold hidden sm:inline">PediDose</span>
        </div>

        <nav className="order-last md:order-none w-full md:w-auto flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count, countTitle }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`relative flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {!!count && (
                  <span
                    title={countTitle}
                    className="min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-semibold flex items-center justify-center"
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-teal-400" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {demoControl}
          {patientControl}

          <HeaderSelect
            title={`Acting as ${role.person} — ${role.description} (X-Role: ${activeRole})`}
            icon={<span className={`w-2 h-2 rounded-full ${role.dot}`} />}
            display={role.label}
            value={activeRole}
            onChange={(v) => onSelectRole(v as ClinicalRole)}
          >
            {ROLE_CONFIG.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label} — {r.person}
              </option>
            ))}
          </HeaderSelect>

          {/* Demo/developer tools live in an overflow menu to keep the bar calm */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="relative p-2 rounded-md text-slate-300 hover:bg-slate-800 cursor-pointer"
              aria-label="More"
              title={serverOnline ? 'FHIR server online' : 'FHIR server offline'}
            >
              <MoreHorizontal className="w-4 h-4" />
              <span
                className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                  serverOnline ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                }`}
              />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 z-20 rounded-lg bg-white text-slate-800 shadow-lg border border-slate-200 py-1 text-sm">
                  <div
                    className="px-3 py-2 flex items-center gap-2 text-xs text-slate-500"
                    title={lastCorrelationId ? `Last Correlation-Id: ${lastCorrelationId}` : undefined}
                  >
                    <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    FHIR server {serverOnline ? 'online' : 'offline'} · localhost:8000
                  </div>
                  <div className="px-3 pb-2 text-xs text-slate-500">
                    Acting as {role.person} · <code className="font-mono">X-Role: {activeRole}</code>
                  </div>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      onToggleTelemetry();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <Terminal className="w-4 h-4 text-slate-500" />
                    {telemetryOpen ? 'Hide' : 'Show'} API log ({exchangeCount})
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => {
                      onResetFixtures();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                    title="POST /fixtures/reset — reset all mock FHIR ServiceRequests and Tasks"
                  >
                    <RotateCcw className={`w-4 h-4 text-slate-500 ${isResetting ? 'animate-spin' : ''}`} />
                    Reset demo data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
