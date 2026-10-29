// Typed client for the Belgian UHMEP v1.4 / Recip-e FHIR R4 Mock Server

export type ClinicalRole = 'assistant' | 'supervisor' | 'pharmacist' | 'patient';

export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueReference?: { reference: string; display?: string };
  valueDateTime?: string;
  extension?: FhirExtension[];
}

export interface FhirServiceRequest {
  resourceType: 'ServiceRequest';
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  identifier?: Array<{ system: string; value: string }>;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: string;
  category?: Array<{ coding: FhirCoding[]; text?: string }>;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: {
    coding: FhirCoding[];
    text?: string;
  };
  subject: {
    reference?: string;
    identifier?: { system: string; value: string };
    display?: string;
  };
  authoredOn?: string;
  requester?: {
    reference: string;
    display?: string;
  };
  performer?: Array<{
    reference: string;
    display?: string;
  }>;
  reasonCode?: Array<{ text: string; coding?: FhirCoding[] }>;
  quantityQuantity?: { value: number; unit?: string };
  occurrencePeriod?: { start?: string; end?: string };
  note?: Array<{ text: string; authorString?: string; time?: string }>;
  patientInstruction?: string;
  extension?: FhirExtension[];
}

export interface FhirTask {
  resourceType: 'Task';
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  status: 'draft' | 'requested' | 'received' | 'accepted' | 'in-progress' | 'completed' | 'cancelled' | 'rejected';
  intent: string;
  priority?: string;
  code?: {
    coding: FhirCoding[];
    text?: string;
  };
  focus?: {
    reference: string;
    display?: string;
  };
  for?: {
    identifier?: { system: string; value: string };
    display?: string;
  };
  authoredOn?: string;
  lastModified?: string;
  requester?: {
    reference: string;
    display?: string;
  };
  owner?: {
    reference: string;
    display?: string;
  };
  note?: Array<{ text: string; authorString?: string; time?: string }>;
}

export interface FhirBundleEntry {
  fullUrl?: string;
  resource: FhirServiceRequest | FhirTask | Record<string, any>;
  search?: { mode: string };
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id?: string;
  type: string;
  timestamp?: string;
  total?: number;
  entry?: FhirBundleEntry[];
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    details?: {
      coding?: FhirCoding[];
      text?: string;
    };
    diagnostics?: string;
  }>;
}

export interface ApiExchangeLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  role: ClinicalRole;
  correlationId: string;
  status: number;
  ok: boolean;
  requestBody?: any;
  responseBody?: any;
  responseHeaders: Record<string, string>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let exchangeListeners: Array<(log: ApiExchangeLog) => void> = [];

export function onApiExchange(listener: (log: ApiExchangeLog) => void) {
  exchangeListeners.push(listener);
  return () => {
    exchangeListeners = exchangeListeners.filter((l) => l !== listener);
  };
}

function makeCorrelationId(): string {
  return `pedidose-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function fhirFetch<T>(
  endpoint: string,
  role: ClinicalRole,
  options: RequestInit = {}
): Promise<{ data: T; status: number; headers: Record<string, string>; correlationId: string }> {
  const correlationId = makeCorrelationId();
  const headers: Record<string, string> = {
    'Accept': 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
    'X-Role': role,
    'Accept-Be-Pseudo': 'urn:be:fgov:ehealth:pseudo:v1',
    'Correlation-Id': correlationId,
    ...(options.headers as Record<string, string> || {}),
  };

  const url = `${API_BASE_URL}${endpoint}`;
  let parsedBody: any = undefined;
  if (typeof options.body === 'string') {
    try {
      parsedBody = JSON.parse(options.body);
    } catch {
      parsedBody = options.body;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    respHeaders[key] = val;
  });

  const data = await res.json();

  const logEntry: ApiExchangeLog = {
    id: correlationId,
    timestamp: new Date().toISOString(),
    method: options.method || 'GET',
    endpoint,
    role,
    correlationId: respHeaders['correlation-id'] || correlationId,
    status: res.status,
    ok: res.ok,
    requestBody: parsedBody,
    responseBody: data,
    responseHeaders: respHeaders,
  };

  exchangeListeners.forEach((cb) => cb(logEntry));

  if (!res.ok) {
    const err = new Error(
      data?.issue?.[0]?.diagnostics || `FHIR HTTP ${res.status} error on ${endpoint}`
    ) as Error & { status?: number; outcome?: FhirOperationOutcome };
    err.status = res.status;
    err.outcome = data;
    throw err;
  }

  return { data: data as T, status: res.status, headers: respHeaders, correlationId };
}

export const uhmepClient = {
  baseUrl: API_BASE_URL,

  async getHealth(role: ClinicalRole = 'assistant') {
    return fhirFetch<{ status: string; timestamp: string }>('/healthz', role);
  },

  async getFixturesSummary(role: ClinicalRole = 'assistant') {
    return fhirFetch<{
      counts: Record<string, number>;
      service_request_statuses: Record<string, string>;
      task_statuses: Record<string, string>;
    }>('/fixtures/summary', role);
  },

  async resetFixtures(role: ClinicalRole = 'supervisor') {
    return fhirFetch<{ status: string; message: string; timestamp: string }>('/fixtures/reset', role, {
      method: 'POST',
    });
  },

  async searchServiceRequests(
    role: ClinicalRole,
    params: { patient?: string; status?: string; requester?: string } = {}
  ) {
    return fhirFetch<FhirBundle>('/ServiceRequest/_search', role, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async createServiceRequest(role: ClinicalRole, resource: Partial<FhirServiceRequest>) {
    return fhirFetch<FhirServiceRequest>('/ServiceRequest', role, {
      method: 'POST',
      body: JSON.stringify({
        resourceType: 'ServiceRequest',
        ...resource,
      }),
    });
  },

  async patchServiceRequest(role: ClinicalRole, id: string, patchPayload: Partial<FhirServiceRequest>) {
    return fhirFetch<FhirServiceRequest>(`/ServiceRequest/${id}`, role, {
      method: 'PATCH',
      body: JSON.stringify(patchPayload),
    });
  },

  async approveServiceRequest(
    role: ClinicalRole,
    id: string,
    approverRoleRef = 'PractitionerRole/pr-role-supervisor-oncology'
  ) {
    return fhirFetch<FhirServiceRequest>(`/ServiceRequest/${id}/$approve`, role, {
      method: 'POST',
      body: JSON.stringify({
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'approver',
            valueReference: {
              reference: approverRoleRef,
              display: 'Prof. Dr. Janssens (Pediatric Oncology Supervisor)',
            },
          },
        ],
      }),
    });
  },

  async rejectServiceRequest(role: ClinicalRole, id: string, reason: string) {
    return fhirFetch<FhirServiceRequest>(`/ServiceRequest/${id}/$reject`, role, {
      method: 'POST',
      body: JSON.stringify({
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'reason',
            valueString: reason,
          },
        ],
      }),
    });
  },

  async getServiceRequestGraph(role: ClinicalRole, id: string) {
    return fhirFetch<FhirBundle>(`/ServiceRequest/${id}/$graph`, role);
  },

  async listTasks(role: ClinicalRole, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return fhirFetch<FhirBundle>(`/Task${query}`, role);
  },

  async patchTask(
    role: ClinicalRole,
    taskId: string,
    payload: { status?: FhirTask['status']; note?: Array<{ text: string; authorString?: string }> }
  ) {
    return fhirFetch<FhirTask>(`/Task/${taskId}`, role, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
