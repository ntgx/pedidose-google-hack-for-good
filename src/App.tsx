import React, { useEffect, useState, useCallback } from 'react';
import {
  Stethoscope,
  GitPullRequestArrow,
  HeartHandshake,
  Terminal,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  ApiExchangeLog,
  ClinicalRole,
  FhirServiceRequest,
  FhirTask,
  onApiExchange,
  uhmepClient,
} from './api/uhmepClient';
import {
  INITIAL_PEDIATRIC_PATIENTS,
  PediatricPatient,
} from './data/pediatricPatients';
import {
  BenchmarkPreset,
  CLINICAL_FORMULARY,
  UC2_BENCHMARK_PRESETS,
  FormularyFormulation,
  FormularyMedication,
} from './data/clinicalFormulary';
import {
  CommunityTipEntry,
  INITIAL_COMMUNITY_TIPS,
} from './data/knowledgeBaseSeed';
import { HeaderRoleSwitcher } from './components/HeaderRoleSwitcher';
import { PatientPanel } from './components/PatientPanel';
import { SmartPrescriberView } from './components/SmartPrescriberView';
import { WorkflowHubView } from './components/WorkflowHubView';
import { CaregiverPortalView } from './components/CaregiverPortalView';
import { OnboardingFlow } from './components/OnboardingFlow';
import { DemoCaseMenu } from './components/DemoCaseMenu';
import { AppliedSuggestion } from './components/AiPrescribeAssistant';

type ActiveTab = 'prescriber' | 'workflow' | 'caregiver';

// Tabs each role actually works in; the first one is where the role lands
const ROLE_TABS: Record<ClinicalRole, ActiveTab[]> = {
  assistant: ['prescriber', 'workflow'],
  supervisor: ['workflow', 'prescriber'],
  pharmacist: ['workflow', 'caregiver'],
  patient: ['caregiver'],
};

export const App: React.FC = () => {
  // Active Clinical Role (maps to X-Role header)
  const [activeRole, setActiveRole] = useState<ClinicalRole>('assistant');
  const [activeTab, setActiveTab] = useState<ActiveTab>('prescriber');
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [patientPanelOpen, setPatientPanelOpen] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null); // no demo until the user picks one
  const [prescriberStep, setPrescriberStep] = useState<number>(0);

  // Patients & Vitals State
  const [patients, setPatients] = useState<PediatricPatient[]>(INITIAL_PEDIATRIC_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(INITIAL_PEDIATRIC_PATIENTS[0].id); // replaced by the setup flow choice

  // Prescriber State
  const [selectedMedication, setSelectedMedication] = useState<FormularyMedication>(
    CLINICAL_FORMULARY[0] // Prednisolone
  );
  const [selectedFormulation, setSelectedFormulation] = useState<FormularyFormulation>(
    CLINICAL_FORMULARY[0].formulations[0] // 10 mg/mL concentrated oral solution
  );
  const [dosePerUnit, setDosePerUnit] = useState<number>(CLINICAL_FORMULARY[0].defaultDosePerUnit);
  const [frequencyPerDay, setFrequencyPerDay] = useState<number>(CLINICAL_FORMULARY[0].defaultFrequencyPerDay);
  const [durationDays, setDurationDays] = useState<number>(21);
  const [overrideVolumeMl, setOverrideVolumeMl] = useState<number | null>(null);

  // Pharmacist Clinical Trial Locks & Community Tips State
  const [customTrialLocks, setCustomTrialLocks] = useState<Record<string, boolean>>({});
  const [communityTips, setCommunityTips] = useState<CommunityTipEntry[]>(INITIAL_COMMUNITY_TIPS);

  // Live FHIR Server State
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [serviceRequests, setServiceRequests] = useState<FhirServiceRequest[]>([]);
  const [tasks, setTasks] = useState<FhirTask[]>([]);
  const [isLoadingFhir, setIsLoadingFhir] = useState<boolean>(false);
  const [isSubmittingRx, setIsSubmittingRx] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // FHIR API Telemetry Logs
  const [exchangeLogs, setExchangeLogs] = useState<ApiExchangeLog[]>([]);
  const [telemetryOpen, setTelemetryOpen] = useState<boolean>(false);

  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Subscribe to FHIR HTTP exchange logs
  useEffect(() => {
    return onApiExchange((entry) => {
      setExchangeLogs((prev) => [entry, ...prev.slice(0, 29)]);
    });
  }, []);

  // Auto-dismiss toasts so they don't pile up over the workspace
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 8000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Fetch ServiceRequests & Tasks from mock server
  const fetchFhirWorkspace = useCallback(async () => {
    setIsLoadingFhir(true);
    try {
      await uhmepClient.getHealth(activeRole);
      setServerOnline(true);

      const [srRes, taskRes] = await Promise.all([
        uhmepClient.searchServiceRequests(activeRole, {}),
        uhmepClient.listTasks(activeRole),
      ]);

      const srList =
        srRes.data.entry
          ?.map((e) => e.resource as FhirServiceRequest)
          .filter((r) => r && r.resourceType === 'ServiceRequest') || [];

      const taskList =
        taskRes.data.entry
          ?.map((e) => e.resource as FhirTask)
          .filter((r) => r && r.resourceType === 'Task') || [];

      setServiceRequests(srList);
      setTasks(taskList);
    } catch {
      setServerOnline(false);
    } finally {
      setIsLoadingFhir(false);
    }
  }, [activeRole]);

  useEffect(() => {
    fetchFhirWorkspace();
  }, [fetchFhirWorkspace]);

  // Update patient vitals live
  const handleUpdateVitals = (
    patientId: string,
    updates: Partial<Pick<PediatricPatient, 'weightKg' | 'heightCm' | 'ageYears' | 'crClMlMin'>>
  ) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, ...updates } : p))
    );
  };

  // Load a 1-click UC2 Benchmark Preset
  const handleSelectPreset = (preset: BenchmarkPreset) => {
    setSelectedPatientId(preset.patientId);
    const med =
      CLINICAL_FORMULARY.find((m) => m.id === preset.medicationId) ||
      CLINICAL_FORMULARY[0];
    const form =
      med.formulations.find((f) => f.id === preset.formulationId) ||
      med.formulations[0];

    setSelectedMedication(med);
    setSelectedFormulation(form);
    setDosePerUnit(preset.dosePerUnit);
    setFrequencyPerDay(med.defaultFrequencyPerDay);
    setDurationDays(preset.durationDays);
    setOverrideVolumeMl(preset.overrideVolumeMl ?? null);
    setActivePresetId(preset.id);
    // Open the step where the case's safety check shows up (supply/reimbursement cases → formulation)
    setPrescriberStep(
      preset.medicationId === 'med-ruxolitinib' || preset.medicationId === 'med-posaconazole' ? 1 : 2
    );
    if (ROLE_TABS[activeRole].includes('prescriber')) setActiveTab('prescriber');
    setToastMessage(`Loaded ${preset.badge}: ${preset.clinicalHighlight}`);
  };

  // Select a Medication from search
  const handleSelectMedication = (med: FormularyMedication) => {
    setActivePresetId(null);
    setSelectedMedication(med);
    setSelectedFormulation(med.formulations[0]);
    setDosePerUnit(med.defaultDosePerUnit);
    setFrequencyPerDay(med.defaultFrequencyPerDay);
    setOverrideVolumeMl(null);
  };

  // Take over an AI suggestion the prescriber has checked (and possibly adjusted)
  const handleApplySuggestion = (s: AppliedSuggestion) => {
    setActivePresetId(null);
    setSelectedMedication(s.medication);
    setSelectedFormulation(s.formulation);
    setDosePerUnit(s.dosePerUnit);
    setFrequencyPerDay(s.frequencyPerDay);
    setDurationDays(s.durationDays);
    setOverrideVolumeMl(null);
  };

  // Select a Formulation
  const handleSelectFormulation = (form: FormularyFormulation) => {
    setSelectedFormulation(form);
    setOverrideVolumeMl(null);
  };

  // Create FHIR ServiceRequest (and optionally $approve immediately if Supervisor)
  const handleSubmitPrescription = async (
    payload: Partial<FhirServiceRequest>,
    autoApproveAsSupervisor: boolean
  ) => {
    setIsSubmittingRx(true);
    try {
      const { data: createdSr, correlationId } = await uhmepClient.createServiceRequest(
        activeRole,
        payload
      );

      if (autoApproveAsSupervisor && activeRole === 'supervisor') {
        await uhmepClient.approveServiceRequest(activeRole, createdSr.id);
        setToastMessage(
          `Created & Co-Signed ServiceRequest/${createdSr.id} (status: active, be-ext-approval attached • Correlation-Id: ${correlationId})`
        );
      } else {
        setToastMessage(
          `Created Draft ServiceRequest/${createdSr.id} + Linked Pharmacy Task on FHIR Server (Correlation-Id: ${correlationId})`
        );
      }

      await fetchFhirWorkspace();
      setActiveTab('workflow');
    } catch (err: any) {
      setToastMessage(
        `FHIR Server Error: ${err?.message || 'Could not create ServiceRequest'}`
      );
    } finally {
      setIsSubmittingRx(false);
    }
  };

  // Reset server fixtures
  const handleResetFixtures = async () => {
    setIsResetting(true);
    try {
      await uhmepClient.resetFixtures(activeRole);
      setCustomTrialLocks({});
      await fetchFhirWorkspace();
      setToastMessage('Reset all FHIR ServiceRequests & Tasks on mock server to initial state.');
    } catch (err: any) {
      setToastMessage(`Reset error: ${err?.message || 'Server unreachable'}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Role switching helper
  // Role switching helper: stay on the current tab if the new role uses it, otherwise go to its landing tab
  const handleRoleSwitch = (role: ClinicalRole) => {
    setActiveRole(role);
    if (!ROLE_TABS[role].includes(activeTab)) {
      setActiveTab(ROLE_TABS[role][0]);
    }
  };

  // Changing patient clears a manually entered syringe volume (it belonged to the old patient)
  const handleSelectPatient = (patientId: string) => {
    if (patientId === selectedPatientId) return;
    setSelectedPatientId(patientId);
    setOverrideVolumeMl(null);
    setActivePresetId(null);
  };

  // Setup flow result: land each role on the tab where its work happens
  const handleCompleteOnboarding = (role: ClinicalRole, patientId: string) => {
    setActiveRole(role);
    handleSelectPatient(patientId);
    setActiveTab(role === 'assistant' ? 'prescriber' : ROLE_TABS[role][0]);
    setOnboarded(true);
  };

  if (!onboarded) {
    return (
      <OnboardingFlow
        patients={patients}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  const allowedTabs = ROLE_TABS[activeRole];
  const currentTab: ActiveTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  const draftCount = serviceRequests.filter((s) => s.status === 'draft').length;
  const openTaskCount = tasks.filter((t) => t.status !== 'completed').length;
  const pendingTipCount = communityTips.filter(
    (t) => t.moderationStatus === 'pending_pharmacist_review'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Persistent header: tabs, patient & role switchers, demo tools */}
      <HeaderRoleSwitcher
        tabs={(
          [
          { id: 'prescriber', label: 'Prescribe', icon: Stethoscope },
          {
            id: 'workflow',
            label: 'Orders',
            icon: GitPullRequestArrow,
            count: draftCount + openTaskCount,
            countTitle: `${draftCount} draft(s) awaiting co-sign · ${openTaskCount} open pharmacy task(s)`,
          },
          {
            id: 'caregiver',
            label: 'Caregiver',
            icon: HeartHandshake,
            // only the pharmacist moderates, so only they get the review count
            count: activeRole === 'pharmacist' ? pendingTipCount : undefined,
            countTitle: `${pendingTipCount} tip(s) awaiting pharmacist review`,
          },
          ] as const
        ).filter((t) => allowedTabs.includes(t.id))}
        activeTab={currentTab}
        onSelectTab={setActiveTab}
        activeRole={activeRole}
        onSelectRole={handleRoleSwitch}
        demoControl={
          <DemoCaseMenu
            presets={UC2_BENCHMARK_PRESETS}
            activePresetId={activePresetId}
            onSelect={handleSelectPreset}
          />
        }
        patientControl={
          <PatientPanel
            patients={patients}
            selectedPatient={selectedPatient}
            onSelectPatient={handleSelectPatient}
            onUpdateVitals={handleUpdateVitals}
            open={patientPanelOpen}
            onOpenChange={setPatientPanelOpen}
          />
        }
        serverOnline={serverOnline}
        lastCorrelationId={exchangeLogs[0]?.correlationId || ''}
        onResetFixtures={handleResetFixtures}
        isResetting={isResetting}
        onToggleTelemetry={() => setTelemetryOpen((o) => !o)}
        telemetryOpen={telemetryOpen}
        exchangeCount={exchangeLogs.length}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 left-4 sm:left-auto z-40 sm:max-w-md">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-start gap-3 text-xs shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="flex-1">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expandable Live FHIR Telemetry Drawer */}
      {telemetryOpen && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-medium text-teal-300">
                  FHIR API log (UHMEP v1.4)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTelemetryOpen(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
              {exchangeLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        log.ok
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      HTTP {log.status}
                    </span>
                    <span className="font-bold text-white">
                      {log.method} {log.endpoint}
                    </span>
                    <span className="text-amber-300">X-Role: {log.role}</span>
                  </div>
                  <div className="text-slate-400">
                    Correlation-Id: <span className="text-teal-300">{log.correlationId}</span> •
                    Pseudo: <span className="text-indigo-300">urn:be:fgov:ehealth:pseudo:v1</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {currentTab === 'prescriber' && (
          <SmartPrescriberView
            activeRole={activeRole}
            patient={selectedPatient}
            selectedMedication={selectedMedication}
            selectedFormulation={selectedFormulation}
            dosePerUnit={dosePerUnit}
            frequencyPerDay={frequencyPerDay}
            durationDays={durationDays}
            overrideVolumeMl={overrideVolumeMl}
            customTrialLocks={customTrialLocks}
            step={prescriberStep}
            onStepChange={setPrescriberStep}
            onSelectMedication={handleSelectMedication}
            onSelectFormulation={handleSelectFormulation}
            onApplySuggestion={handleApplySuggestion}
            onChangeDosePerUnit={setDosePerUnit}
            onChangeFrequencyPerDay={setFrequencyPerDay}
            onChangeDurationDays={setDurationDays}
            onChangeOverrideVolumeMl={setOverrideVolumeMl}
            onSubmitPrescription={handleSubmitPrescription}
            isSubmitting={isSubmittingRx}
            onNavigateToCaregiverCompanion={
              allowedTabs.includes('caregiver') ? () => setActiveTab('caregiver') : undefined
            }
            onUpdateVitals={handleUpdateVitals}
          />
        )}

        {currentTab === 'workflow' && (
          <WorkflowHubView
            activeRole={activeRole}
            patients={patients}
            selectedPatient={selectedPatient}
            serviceRequests={serviceRequests}
            tasks={tasks}
            isLoading={isLoadingFhir}
            onRefresh={fetchFhirWorkspace}
            customTrialLocks={customTrialLocks}
            onToggleTrialLock={(key, nextVal) =>
              setCustomTrialLocks((prev) => ({ ...prev, [key]: nextVal }))
            }
          />
        )}

        {currentTab === 'caregiver' && (
          <CaregiverPortalView
            activeRole={activeRole}
            patient={selectedPatient}
            selectedMedication={selectedMedication}
            selectedFormulation={selectedFormulation}
            dosePerUnit={dosePerUnit}
            frequencyPerDay={frequencyPerDay}
            durationDays={durationDays}
            communityTips={communityTips}
            onAddCommunityTip={(tip) => setCommunityTips((prev) => [tip, ...prev])}
            onModerateTip={(tipId, newStatus) =>
              setCommunityTips((prev) =>
                prev.map((t) =>
                  t.id === tipId
                    ? {
                        ...t,
                        moderationStatus: newStatus,
                        verifiedByPharmacist:
                          newStatus === 'approved_gold_standard'
                            ? 'Apr. S. Vanacker (Approved for Caregiver Companion)'
                            : undefined,
                      }
                    : t
                )
              )
            }
            onUpvoteTip={(tipId) =>
              setCommunityTips((prev) =>
                prev.map((t) => (t.id === tipId ? { ...t, upvotes: t.upvotes + 1 } : t))
              )
            }
          />
        )}
      </main>
    </div>
  );
};

export default App;
