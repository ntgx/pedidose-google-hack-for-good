import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Network,
  PackageCheck,
  Clock,
  ShieldAlert,
  Lock,
  Unlock,
  RefreshCw,
  FileCode2,
  X,
  Play,
  UserCheck,
} from 'lucide-react';
import {
  ClinicalRole,
  FhirBundle,
  FhirServiceRequest,
  FhirTask,
  uhmepClient,
} from '../api/uhmepClient';
import { PediatricPatient } from '../data/pediatricPatients';
import { CLINICAL_FORMULARY } from '../data/clinicalFormulary';
import { Alert, Badge, Button, Card, CountPill, SectionTitle, SegmentedTabs, Tone } from './ui';

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
  const [graphBundle, setGraphBundle] = useState<FhirBundle | null>(null);
  const [graphTargetId, setGraphTargetId] = useState<string | null>(null);
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

  // Helper to find linked Task for a ServiceRequest
  const getLinkedTask = (srId: string): FhirTask | undefined => {
    return tasks.find((t) => t.focus?.reference === `ServiceRequest/${srId}`);
  };

  // Approve ServiceRequest ($approve)
  const handleApprove = async (srId: string) => {
    setBusyId(srId);
    setActionBanner(null);
    try {
      const { data, correlationId } = await uhmepClient.approveServiceRequest(activeRole, srId);
      setActionBanner({
        type: 'success',
        title: `POST /ServiceRequest/${srId}/$approve → HTTP 200 OK (Status: ${data.status})`,
        detail: `Co-signed with Belgian extension 'be-ext-approval'. Correlation-Id: ${correlationId}`,
      });
      await onRefresh();
    } catch (err: any) {
      const diag =
        err?.outcome?.issue?.[0]?.diagnostics ||
        err?.message ||
        'FHIR $approve operation rejected';
      setActionBanner({
        type: 'error',
        title: `FHIR Role Guardrail Triggered (HTTP ${err?.status || 403} OperationOutcome)`,
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
      const { data, correlationId } = await uhmepClient.rejectServiceRequest(
        activeRole,
        srId,
        reason
      );
      setActionBanner({
        type: 'success',
        title: `POST /ServiceRequest/${srId}/$reject → HTTP 200 OK (Status: ${data.status})`,
        detail: `Prescription revoked. Correlation-Id: ${correlationId}`,
      });
      await onRefresh();
    } catch (err: any) {
      const diag =
        err?.outcome?.issue?.[0]?.diagnostics || err?.message || 'FHIR $reject operation rejected';
      setActionBanner({
        type: 'error',
        title: `FHIR Role Guardrail Triggered (HTTP ${err?.status || 403} OperationOutcome)`,
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
      const { data, correlationId } = await uhmepClient.patchTask(activeRole, task.id, {
        status: nextStatus,
        note: [{ authorString: 'Apr. S. Vanacker (Clinical Pharmacist)', text: noteText }],
      });
      setActionBanner({
        type: 'success',
        title: `PATCH /Task/${task.id} → Status '${data.status}'`,
        detail:
          nextStatus === 'completed'
            ? `Task completed! Mock server automatically transitioned linked ${task.focus?.reference} to 'completed'. (Correlation-Id: ${correlationId})`
            : `Task updated to '${nextStatus}'. (Correlation-Id: ${correlationId})`,
      });
      await onRefresh();
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        title: `Failed to PATCH /Task/${task.id}`,
        detail: err?.message || 'Error updating Task',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Inspect $graph Bundle
  const handleInspectGraph = async (srId: string) => {
    setBusyId(srId);
    try {
      const { data } = await uhmepClient.getServiceRequestGraph(activeRole, srId);
      setGraphTargetId(srId);
      setGraphBundle(data);
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        title: `Failed to fetch /ServiceRequest/${srId}/$graph`,
        detail: err?.message || 'Graph error',
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
          <span className="font-mono text-[11px]">{actionBanner.detail}</span>
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
            <Button onClick={onRefresh} title="Re-fetch ServiceRequests & Tasks from the FHIR server">
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
            const approvalExt = sr.extension?.find((ext) => ext.url.includes('be-ext-approval'));
            const canProgressTask =
              linkedTask && sr.status !== 'revoked' && linkedTask.status !== 'completed';

            return (
              <Card key={sr.id} className="!p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    className="order-last ml-auto !px-2 !py-1"
                    onClick={() => handleInspectGraph(sr.id)}
                    title="GET /ServiceRequest/{id}/$graph — inspect the full FHIR R4 resource Bundle"
                  >
                    <Network className="w-3.5 h-3.5" />
                    FHIR graph
                  </Button>
                  <Badge tone={statusTone(sr.status)} className="uppercase">
                    {sr.status}
                  </Badge>
                  {(sr.priority === 'urgent' || sr.priority === 'stat') && (
                    <Badge tone="danger">{sr.priority}</Badge>
                  )}
                  {approvalExt && (
                    <Badge tone="success" title="be-ext-approval extension attached">
                      <UserCheck className="w-3 h-3" />
                      Co-signed
                    </Badge>
                  )}
                  {linkedTask && (
                    <Badge title={`Task/${linkedTask.id}`}>
                      <Clock className="w-3 h-3" />
                      Pharmacy: {linkedTask.status}
                    </Badge>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-2">
                  {sr.code?.text || sr.code?.coding?.[0]?.display || 'Pediatric Prescription'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sr.subject?.display || sr.subject?.identifier?.value} · by{' '}
                  {sr.requester?.display || sr.requester?.reference}
                  {sr.reasonCode?.[0]?.text && <> · {sr.reasonCode[0].text}</>}
                </p>

                <details className="mt-2 group">
                  <summary className="text-xs text-indigo-700 cursor-pointer select-none">
                    Details
                  </summary>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="font-mono text-[11px] text-slate-500">
                      ServiceRequest/{sr.id}
                      {linkedTask && <> · Task/{linkedTask.id}</>}
                    </div>
                    {sr.patientInstruction && (
                      <div className="bg-teal-50 text-teal-950 px-3 py-2 rounded-md">
                        <strong>Caregiver instruction:</strong> {sr.patientInstruction}
                      </div>
                    )}
                    {sr.note && sr.note.length > 0 && (
                      <div className="text-[11px] text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded-md">
                        {sr.note[sr.note.length - 1].text}
                      </div>
                    )}
                  </div>
                </details>

                {(sr.status === 'draft' || canProgressTask) && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {sr.status === 'draft' && (
                    <>
                      <Button
                        variant={activeRole === 'supervisor' ? 'primary' : 'secondary'}
                        disabled={busyId === sr.id}
                        onClick={() => handleApprove(sr.id)}
                        title={
                          activeRole === 'supervisor'
                            ? 'POST /ServiceRequest/{id}/$approve as Supervisor'
                            : 'Calling $approve as a non-supervisor demonstrates the HTTP 403 OperationOutcome guardrail'
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {activeRole === 'supervisor' ? 'Co-sign' : `Co-sign as ${activeRole} (expect 403)`}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === sr.id}
                        onClick={() => handleReject(sr.id)}
                        title="POST /ServiceRequest/{id}/$reject"
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
                      title="PATCH /Task/{id} → in-progress"
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
                      title="PATCH /Task/{id} → completed (also completes the ServiceRequest)"
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
          <Card>
            <SectionTitle title="How approval works" />
            <ol className="space-y-2.5 text-xs text-slate-600">
              <li className="flex gap-2">
                <Badge tone="warning">1</Badge>
                <span>
                  <strong className="text-slate-900">Assistant</strong> saves a draft{' '}
                  <code className="font-mono">ServiceRequest</code>.
                </span>
              </li>
              <li className="flex gap-2">
                <Badge tone="info">2</Badge>
                <span>
                  <strong className="text-slate-900">Supervisor</strong> co-signs via{' '}
                  <code className="font-mono">$approve</code> (adds <code className="font-mono">be-ext-approval</code>).
                  Other roles get HTTP 403 — try it.
                </span>
              </li>
              <li className="flex gap-2">
                <Badge tone="success">3</Badge>
                <span>
                  <strong className="text-slate-900">Pharmacist</strong> moves the{' '}
                  <code className="font-mono">Task</code> to in-progress → completed, which completes the order.
                </span>
              </li>
            </ol>
          </Card>

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

      {/* $graph FHIR Bundle Modal */}
      {graphBundle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    FHIR <code className="font-mono">$graph</code> — ServiceRequest/{graphTargetId}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {graphBundle.entry?.length || 0} linked resources (ServiceRequest, PractitionerRole,
                    Practitioner, Organization, Task)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGraphBundle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="flex flex-wrap gap-1.5">
                {graphBundle.entry?.map((e, idx) => (
                  <Badge key={idx} tone="info" mono>
                    {e.resource?.resourceType}/{e.resource?.id}
                  </Badge>
                ))}
              </div>
              <pre className="bg-slate-950 text-teal-300 p-4 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(graphBundle, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
