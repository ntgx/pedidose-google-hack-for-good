import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Clock,
  ShieldAlert,
  Lock,
  Unlock,
  RefreshCw,
  Play,
  UserCheck,
} from 'lucide-react';
import { ClinicalRole, FhirServiceRequest, FhirTask, uhmepClient } from '../api/uhmepClient';
import { PediatricPatient } from '../data/pediatricPatients';
import { CLINICAL_FORMULARY } from '../data/clinicalFormulary';
import { calculateMostellerBsa } from '../utils/dosingCalculator';
import { MedicationList, PatientSafetyFacts } from './PatientPanel';
import { Alert, Badge, Button, Card, CountPill, SectionTitle, SegmentedTabs, Tone } from './ui';

// Seed orders sometimes carry only a PractitionerRole reference; show the clinician's name instead
const PRESCRIBER_NAMES: Record<string, string> = {
  'PractitionerRole/role-physician-dupont': 'Dr. Jean Dupont',
  'PractitionerRole/role-physician-claes': 'Dr. Marie Claes',
};

const PHARMACY_STATUS_LABEL: Partial<Record<FhirTask['status'], string>> = {
  requested: 'To prepare',
  received: 'To prepare',
  accepted: 'To prepare',
  'in-progress': 'Compounding',
  completed: 'Dispensed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

// First word of each allergy entry ("Amoxicillin (rash)" → "amoxicillin") matched against the order text
const allergyHits = (patient: PediatricPatient | undefined, orderText: string) =>
  (patient?.allergies ?? []).filter((a) => {
    const drug = a.split(/[\s(]/)[0].toLowerCase();
    return drug.length > 3 && !/none/i.test(a) && orderText.toLowerCase().includes(drug);
  });

interface WorkflowHubViewProps {
  activeRole: ClinicalRole;
  patients: PediatricPatient[];
  selectedPatient: PediatricPatient;
  serviceRequests: FhirServiceRequest[];
  tasks: FhirTask[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  customTrialLocks: Record<string, boolean>;
  onToggleTrialLock: (key: string, nextVal: boolean) => void;
}

export const WorkflowHubView: React.FC<WorkflowHubViewProps> = ({
  activeRole,
  patients,
  selectedPatient,
  serviceRequests: allServiceRequests,
  tasks,
  isLoading,
  onRefresh,
  customTrialLocks,
  onToggleTrialLock,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    title: string;
    detail: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pharmacists work one patient at a time, so they only see the selected patient's orders
  const serviceRequests =
    activeRole === 'pharmacist'
      ? allServiceRequests.filter(
          (sr) =>
            sr.subject?.identifier?.value === selectedPatient.pseudoSsin ||
            sr.subject?.reference === `Patient/${selectedPatient.id}`
        )
      : allServiceRequests;

  const filteredRequests = serviceRequests.filter((sr) => {
    if (statusFilter === 'all') return true;
    return sr.status === statusFilter;
  });

  const patientFor = (sr: FhirServiceRequest) =>
    patients.find(
      (p) => sr.subject?.identifier?.value === p.pseudoSsin || sr.subject?.reference === `Patient/${p.id}`
    );

  // Helper to find linked Task for a ServiceRequest
  const getLinkedTask = (srId: string): FhirTask | undefined => {
    return tasks.find((t) => t.focus?.reference === `ServiceRequest/${srId}`);
  };

  // Approve ServiceRequest ($approve)
  const handleApprove = async (srId: string) => {
    setBusyId(srId);
    setActionBanner(null);
    try {
      await uhmepClient.approveServiceRequest(activeRole, srId);
      setActionBanner({
        type: 'success',
        title: 'Order co-signed',
        detail: 'The order is now active and released to the pharmacy.',
      });
      await onRefresh();
    } catch (err: any) {
      const diag =
        err?.outcome?.issue?.[0]?.diagnostics ||
        err?.message ||
        'Co-signing was refused';
      setActionBanner({
        type: 'error',
        title: 'Only a supervisor can co-sign this order',
        detail: diag,
      });
    } finally {
      setBusyId(null);
    }
  };

  // Reject ServiceRequest ($reject)
  const handleReject = async (srId: string) => {
    setBusyId(srId);
    setActionBanner(null);
    try {
      const reason =
        'Supervisor clinical review: Dose/formulation requires revision prior to dispensing.';
      await uhmepClient.rejectServiceRequest(activeRole, srId, reason);
      setActionBanner({
        type: 'success',
        title: 'Order rejected',
        detail: 'The prescription was revoked and sent back to the prescriber for revision.',
      });
      await onRefresh();
    } catch (err: any) {
      const diag =
        err?.outcome?.issue?.[0]?.diagnostics || err?.message || 'Rejection was refused';
      setActionBanner({
        type: 'error',
        title: 'You are not allowed to reject this order',
        detail: diag,
      });
    } finally {
      setBusyId(null);
    }
  };

  // Update Pharmacy Dispense Task (PATCH /Task/{id})
  const handleTaskStatus = async (task: FhirTask, nextStatus: FhirTask['status']) => {
    setBusyId(task.id);
    setActionBanner(null);
    try {
      const noteText =
        nextStatus === 'in-progress'
          ? 'Hospital Pharmacy compounding / IMP accountability verification started by Apr. Vanacker.'
          : 'Medication compounded, verified with EnFit oral syringe adapter, and dispensed to caregiver.';
      await uhmepClient.patchTask(activeRole, task.id, {
        status: nextStatus,
        note: [{ authorString: 'Apr. S. Vanacker (Clinical Pharmacist)', text: noteText }],
      });
      setActionBanner({
        type: 'success',
        title: nextStatus === 'completed' ? 'Dispensed — order completed' : 'Compounding started',
        detail: noteText,
      });
      await onRefresh();
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        title: 'Could not update the pharmacy status',
        detail: err?.message || 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const statusTone = (status: string): Tone =>
    status === 'draft'
      ? 'warning'
      : status === 'active'
      ? 'info'
      : status === 'completed'
      ? 'success'
      : 'danger';

  const countFor = (st: string) =>
    st === 'all' ? serviceRequests.length : serviceRequests.filter((s) => s.status === st).length;

  return (
    <div className="space-y-5">
      {actionBanner && (
        <Alert
          tone={actionBanner.type === 'success' ? 'success' : 'danger'}
          icon={actionBanner.type === 'success' ? CheckCircle2 : ShieldAlert}
          title={actionBanner.title}
          onDismiss={() => setActionBanner(null)}
        >
          {actionBanner.detail}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Orders list */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedTabs
              value={statusFilter}
              onChange={setStatusFilter}
              items={(['all', 'draft', 'active', 'completed', 'revoked'] as const).map((st) => ({
                id: st,
                label: st[0].toUpperCase() + st.slice(1),
                badge: <CountPill>{countFor(st)}</CountPill>,
              }))}
            />
            <Button onClick={onRefresh} title="Reload orders">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {filteredRequests.length === 0 && (
            <Card className="text-center text-sm text-slate-500">
              No {statusFilter === 'all' ? '' : statusFilter} prescriptions
              {activeRole === 'pharmacist' ? ` for ${selectedPatient.shortName}` : ''}. Create one in the
              Prescribe tab.
            </Card>
          )}

          {filteredRequests.map((sr) => {
            const linkedTask = getLinkedTask(sr.id);
            const patient = patientFor(sr);
            const approvalExt = sr.extension?.find((ext) => ext.url.includes('be-ext-approval'));
            // Pharmacy only prepares orders that have been co-signed
            const canProgressTask =
              linkedTask && sr.status === 'active' && linkedTask.status !== 'completed';
            const orderText = sr.code?.text || sr.code?.coding?.[0]?.display || 'Pediatric prescription';
            const prescriber =
              sr.requester?.display || PRESCRIBER_NAMES[sr.requester?.reference ?? ''] || 'Unknown prescriber';
            const rxNumber = sr.identifier?.[0]?.value;
            const allergies = allergyHits(patient, orderText);
            const latestNote = sr.note?.[sr.note.length - 1]?.text;
            const facts: Array<[string, React.ReactNode]> = [];
            if (sr.reasonCode?.[0]?.text) facts.push(['Indication', sr.reasonCode[0].text]);
            if (sr.quantityQuantity)
              facts.push(['Quantity', `${sr.quantityQuantity.value} ${sr.quantityQuantity.unit ?? ''}`.trim()]);
            if (sr.occurrencePeriod?.end)
              facts.push(['Valid', `${formatDate(sr.occurrencePeriod.start) ?? '—'} → ${formatDate(sr.occurrencePeriod.end)}`]);
            if (sr.category?.[0]?.text) facts.push(['Order type', sr.category[0].text]);

            return (
              <Card key={sr.id} className="!p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={statusTone(sr.status)} className="uppercase">
                    {sr.status === 'draft' ? 'Awaiting co-sign' : sr.status}
                  </Badge>
                  {(sr.priority === 'urgent' || sr.priority === 'stat') && (
                    <Badge tone="danger">{sr.priority}</Badge>
                  )}
                  {approvalExt && (
                    <Badge tone="success" title={approvalExt.valueString}>
                      <UserCheck className="w-3 h-3" />
                      Co-signed
                    </Badge>
                  )}
                  {linkedTask && (
                    <Badge>
                      <Clock className="w-3 h-3" />
                      Pharmacy: {PHARMACY_STATUS_LABEL[linkedTask.status] ?? linkedTask.status}
                    </Badge>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-2">{orderText}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeRole !== 'pharmacist' && patient && <>{patient.shortName} · </>}
                  {prescriber}
                  {sr.authoredOn && <> · ordered {formatDate(sr.authoredOn)}</>}
                  {rxNumber && <> · Rx {rxNumber}</>}
                </p>

                {allergies.length > 0 && (
                  <div className="mt-2">
                    <Alert tone="danger" icon={AlertTriangle} title={`Allergy: ${allergies.join(', ')}`} />
                  </div>
                )}

                {facts.length > 0 && (
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {facts.map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
                        <dd className="text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {(latestNote || sr.patientInstruction) && (
                  <div className="mt-3 space-y-2 text-xs leading-relaxed">
                    {latestNote && (
                      <div className="bg-slate-50 text-slate-700 px-3 py-2 rounded-md">
                        <strong className="text-slate-900">Prescriber note:</strong> {latestNote}
                      </div>
                    )}
                    {sr.patientInstruction && (
                      <div className="bg-teal-50 text-teal-950 px-3 py-2 rounded-md">
                        <strong>Caregiver instruction:</strong> {sr.patientInstruction}
                      </div>
                    )}
                  </div>
                )}

                {(sr.status === 'draft' || canProgressTask) && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {sr.status === 'draft' && (
                    <>
                      {activeRole !== 'pharmacist' && (
                      <Button
                        variant={activeRole === 'supervisor' ? 'primary' : 'secondary'}
                        disabled={busyId === sr.id}
                        onClick={() => handleApprove(sr.id)}
                        title={
                          activeRole === 'supervisor'
                            ? 'Co-sign and release to the pharmacy'
                            : 'Only a supervisor can co-sign — trying shows the permission check'
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {activeRole === 'supervisor' ? 'Co-sign' : `Co-sign as ${activeRole} (expect 403)`}
                      </Button>
                      )}
                      <Button
                        variant="danger"
                        disabled={busyId === sr.id}
                        onClick={() => handleReject(sr.id)}
                        title="Send back to the prescriber for revision"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </>
                  )}

                  {canProgressTask && linkedTask.status === 'requested' && (
                    <Button
                      disabled={busyId === linkedTask.id}
                      onClick={() => handleTaskStatus(linkedTask, 'in-progress')}
                      title="Mark this order as being compounded"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start compounding
                    </Button>
                  )}
                  {canProgressTask && (
                    <Button
                      variant="success"
                      disabled={busyId === linkedTask.id}
                      onClick={() => handleTaskStatus(linkedTask, 'completed')}
                      title="Mark as dispensed to the caregiver; completes the order"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      Dispense & complete
                    </Button>
                  )}
                </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Sidebar: how the flow works + pharmacist trial locks */}
        <div className="lg:col-span-4 space-y-5">
          {activeRole === 'pharmacist' ? (
            <PharmacistPatientCard patient={selectedPatient} />
          ) : (
            <Card>
              <SectionTitle title="How approval works" />
              <ol className="space-y-2.5 text-xs text-slate-600">
                <li className="flex gap-2">
                  <Badge tone="warning">1</Badge>
                  <span>
                    <strong className="text-slate-900">Assistant</strong> saves a draft order.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Badge tone="info">2</Badge>
                  <span>
                    <strong className="text-slate-900">Supervisor</strong> co-signs it. Other roles are
                    blocked — try it.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Badge tone="success">3</Badge>
                  <span>
                    <strong className="text-slate-900">Pharmacist</strong> compounds and dispenses, which
                    completes the order.
                  </span>
                </li>
              </ol>
            </Card>
          )}

          <Card>
            <SectionTitle
              title="Clinical trial locks"
              hint="Pharmacists lock study drugs per patient so a commercial Recip-e prescription can't be issued."
            />
            <div className="space-y-2">
              {patients.slice(0, 2).map((pat) => {
                const ruxoMed = CLINICAL_FORMULARY.find((m) => m.id === 'med-ruxolitinib')!;
                const lockKey = `${pat.id}:${ruxoMed.id}`;
                const isLocked =
                  lockKey in customTrialLocks
                    ? customTrialLocks[lockKey]
                    : pat.activeStudyId === 'HEM-iSmart';

                return (
                  <div
                    key={pat.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="text-xs">
                      <div className="font-medium text-slate-900">{pat.shortName}</div>
                      <div className="text-slate-500">
                        Ruxolitinib · {pat.activeStudyId || 'HEM-iSmart optional'}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLocked}
                      onClick={() => onToggleTrialLock(lockKey, !isLocked)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                        isLocked
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isLocked ? 'Recip-e locked — IMP stock only' : 'Commercial prescribing allowed'}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {isLocked ? 'Locked (IMP only)' : 'Unlocked'}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
};

// What a pharmacist checks before compounding: size for dose verification, renal function, allergies, interactions
const PharmacistPatientCard: React.FC<{ patient: PediatricPatient }> = ({ patient: p }) => {
  const bsa = calculateMostellerBsa(p.weightKg, p.heightCm);
  const currentMeds = p.medications.filter((m) => m.status !== 'stopped');
  const vitals: Array<[string, string, boolean?]> = [
    ['Weight', `${p.weightKg} kg`],
    ['Height', `${p.heightCm} cm`],
    ['BSA', `${bsa.toFixed(2)} m²`],
    ['CrCl', `${p.crClMlMin} mL/min`, p.crClMlMin <= 50],
  ];
  return (
    <Card>
      <SectionTitle
        title={p.shortName}
        hint={`${p.ageYears}y ${p.sex} · ${p.ward}`}
      />
      <div className="text-xs text-slate-600 mb-3">
        {p.diagnosis}
        <div className="text-slate-400">{p.protocol}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {vitals.map(([label, value, warn]) => (
          <div
            key={label}
            className={`rounded-lg border px-3 py-1.5 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
          >
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="text-sm font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 mb-3">
        <PatientSafetyFacts patient={p} compact />
      </div>
      <div className="text-xs font-semibold text-slate-900 mb-1.5">Current medication ({currentMeds.length})</div>
      <MedicationList meds={currentMeds} emptyText="No current medication." />
    </Card>
  );
};
