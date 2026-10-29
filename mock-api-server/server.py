#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "fastapi>=0.110.0",
#     "uvicorn>=0.29.0",
#     "pydantic>=2.6.0",
#     "python-multipart>=0.0.9",
# ]
# ///
"""
UHMEP (Referral Prescription) FHIR Mock API Server
=================================================
A self-contained mock server implementing the Belgian eHealth UHMEP v1.4 FHIR specification
and Recip-e FHIR Medication Prescription guidelines.

Features:
- Single-file execution with `uv run server.py` or `./server.py`
- Pre-seeded SQLite database (`uhmep_mock.db`) with realistic Belgian healthcare fixtures
- Interactive Swagger UI at `/docs`, ReDoc at `/redoc`, and OpenAPI JSON at `/openapi.json`
- CapabilityStatement at `/metadata`
- Complete CRUD & search for ServiceRequest, Task, Practitioner, PractitionerRole, Organization
- Custom operations: `$graph`, `$approve`, `$reject`
- MedicationRequest compatibility aliases
- Role simulation via `X-Role` / `Authorization: Bearer <role>` headers
- Standard FHIR OperationOutcome errors and Belgian error codes (`urn:be:uhmep:mp:errors`)
"""

import argparse
import datetime
import json
import os
import sqlite3
import uuid
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import Body, FastAPI, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# Configuration & Constants
# -----------------------------------------------------------------------------
DEFAULT_DB_FILE = os.getenv("UHMEP_DB_PATH", "uhmep_mock.db")
FHIR_JSON_MEDIA_TYPE = "application/fhir+json"
DEFAULT_PSEUDO_VERSION = "urn:be:fgov:ehealth:pseudo:v1"
ERROR_SYSTEM = "urn:be:uhmep:mp:errors"


# -----------------------------------------------------------------------------
# Database Setup & Persistence Layer
# -----------------------------------------------------------------------------
def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target_path = db_path or os.getenv("UHMEP_DB_PATH", DEFAULT_DB_FILE)
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None, force_reset: bool = False):
    """Initializes the database schema and seeds default fixtures if empty or forced."""
    target_path = db_path or os.getenv("UHMEP_DB_PATH", DEFAULT_DB_FILE)
    if force_reset and os.path.exists(target_path):
        try:
            os.remove(target_path)
        except OSError:
            pass

    conn = get_db_connection(target_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS resources (
            resource_type TEXT NOT NULL,
            id TEXT NOT NULL,
            version_id INTEGER NOT NULL DEFAULT 1,
            status TEXT,
            subject TEXT,
            requester TEXT,
            data JSON NOT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (resource_type, id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_resources_requester ON resources(requester)")

    cursor.execute("SELECT COUNT(*) FROM resources")
    count = cursor.fetchone()[0]

    if count == 0 or force_reset:
        seed_fixtures(conn)

    conn.commit()
    conn.close()


def save_resource(
    resource_type: str,
    res_id: str,
    data: Dict[str, Any],
    conn: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    status_val = data.get("status")

    # Extract subject identifier or reference if present
    subject_val = None
    if "subject" in data:
        if isinstance(data["subject"], dict):
            subject_val = (
                data["subject"].get("reference")
                or data["subject"].get("identifier", {}).get("value")
            )
        elif isinstance(data["subject"], str):
            subject_val = data["subject"]

    # Extract requester reference
    requester_val = None
    if "requester" in data:
        if isinstance(data["requester"], dict):
            requester_val = data["requester"].get("reference")
        elif isinstance(data["requester"], str):
            requester_val = data["requester"]

    # Ensure meta element with version
    if "meta" not in data:
        data["meta"] = {}

    cursor = conn.cursor()
    cursor.execute(
        "SELECT version_id, created_at FROM resources WHERE resource_type = ? AND id = ?",
        (resource_type, res_id),
    )
    existing = cursor.fetchone()

    if existing:
        new_version = existing["version_id"] + 1
        data["meta"]["versionId"] = str(new_version)
        data["meta"]["lastUpdated"] = now
        cursor.execute(
            """
            UPDATE resources
            SET version_id = ?, status = ?, subject = ?, requester = ?, data = ?, is_deleted = 0, updated_at = ?
            WHERE resource_type = ? AND id = ?
            """,
            (new_version, status_val, subject_val, requester_val, json.dumps(data), now, resource_type, res_id),
        )
    else:
        data["meta"]["versionId"] = "1"
        data["meta"]["lastUpdated"] = now
        cursor.execute(
            """
            INSERT INTO resources (resource_type, id, version_id, status, subject, requester, data, is_deleted, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?, ?, ?, 0, ?, ?)
            """,
            (resource_type, res_id, status_val, subject_val, requester_val, json.dumps(data), now, now),
        )

    conn.commit()
    if should_close:
        conn.close()
    return data


def load_resource(resource_type: str, res_id: str, conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute(
        "SELECT data FROM resources WHERE resource_type = ? AND id = ? AND is_deleted = 0",
        (resource_type, res_id),
    )
    row = cursor.fetchone()
    if should_close:
        conn.close()
    if row:
        return json.loads(row["data"])
    return None


def delete_resource_logic(resource_type: str, res_id: str, conn: Optional[sqlite3.Connection] = None) -> bool:
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute(
        "SELECT data FROM resources WHERE resource_type = ? AND id = ? AND is_deleted = 0",
        (resource_type, res_id),
    )
    row = cursor.fetchone()
    if not row:
        if should_close:
            conn.close()
        return False

    data = json.loads(row["data"])
    data["status"] = "cancelled"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute(
        """
        UPDATE resources
        SET is_deleted = 1, status = 'cancelled', data = ?, updated_at = ?
        WHERE resource_type = ? AND id = ?
        """,
        (json.dumps(data), now, resource_type, res_id),
    )
    conn.commit()
    if should_close:
        conn.close()
    return True


# -----------------------------------------------------------------------------
# Fixtures Seeder
# -----------------------------------------------------------------------------
def seed_fixtures(conn: sqlite3.Connection):
    """Populates realistic Belgian eHealth UHMEP fixtures."""
    fixtures: List[Dict[str, Any]] = [
        # --- Organizations ---
        {
            "resourceType": "Organization",
            "id": "org-hopital-saint-luc",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi-organization",
                    "value": "71000123",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/cbe",
                    "value": "0419052272",
                },
            ],
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                            "code": "prov",
                            "display": "Healthcare Provider",
                        }
                    ],
                    "text": "Hospital",
                }
            ],
            "name": "Cliniques Universitaires Saint-Luc",
            "telecom": [{"system": "phone", "value": "+32 2 764 11 11"}],
            "address": [
                {
                    "line": ["Avenue Hippocrate 10"],
                    "city": "Woluwe-Saint-Lambert",
                    "postalCode": "1200",
                    "country": "BE",
                }
            ],
        },
        {
            "resourceType": "Organization",
            "id": "org-apotheek-janssen",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi-organization",
                    "value": "56009876",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/cbe",
                    "value": "0434567890",
                },
            ],
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                            "code": "pharmacy",
                            "display": "Pharmacy",
                        }
                    ],
                    "text": "Community Pharmacy",
                }
            ],
            "name": "Apotheek Janssen Brussel",
            "telecom": [{"system": "phone", "value": "+32 2 511 22 33"}],
            "address": [
                {
                    "line": ["Rue Neuve 45"],
                    "city": "Bruxelles",
                    "postalCode": "1000",
                    "country": "BE",
                }
            ],
        },
        {
            "resourceType": "Organization",
            "id": "org-apotheek-centrum-antwerpen",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi-organization",
                    "value": "56001234",
                }
            ],
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                            "code": "pharmacy",
                            "display": "Pharmacy",
                        }
                    ],
                    "text": "Community Pharmacy",
                }
            ],
            "name": "Apotheek Centrum Antwerpen",
            "address": [
                {
                    "line": ["Meir 88"],
                    "city": "Antwerpen",
                    "postalCode": "2000",
                    "country": "BE",
                }
            ],
        },
        # --- Practitioners ---
        {
            "resourceType": "Practitioner",
            "id": "practitioner-dr-dupont",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "19766016004",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "90010212345",
                },
            ],
            "name": [{"use": "official", "family": "Dupont", "given": ["Jean"]}],
            "gender": "male",
        },
        {
            "resourceType": "Practitioner",
            "id": "practitioner-dr-peeters",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "18543219002",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "85031523456",
                },
            ],
            "name": [{"use": "official", "family": "Peeters", "given": ["An"]}],
            "gender": "female",
        },
        {
            "resourceType": "Practitioner",
            "id": "practitioner-pharm-janssen",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "20017534001",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "88072034567",
                },
            ],
            "name": [{"use": "official", "family": "Janssen", "given": ["Hendrik"]}],
            "gender": "male",
        },
        {
            "resourceType": "Practitioner",
            "id": "practitioner-dr-claes",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "19876543001",
                },
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "92051245678",
                },
            ],
            "name": [{"use": "official", "family": "Claes", "given": ["Marie"]}],
            "gender": "female",
        },
        # --- PractitionerRoles ---
        {
            "resourceType": "PractitionerRole",
            "id": "role-physician-dupont",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "19766016004",
                }
            ],
            "practitioner": {"reference": "Practitioner/practitioner-dr-dupont", "display": "Dr. Jean Dupont"},
            "organization": {"reference": "Organization/org-hopital-saint-luc", "display": "Cliniques Universitaires Saint-Luc"},
            "code": [
                {
                    "coding": [
                        {
                            "system": "https://www.ehealth.fgov.be/standards/fhir/core/CodeSystem/cd-hcparty",
                            "code": "persphysician",
                            "display": "Physician",
                        }
                    ]
                }
            ],
        },
        {
            "resourceType": "PractitionerRole",
            "id": "role-pharmacy-janssen",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "20017534001",
                }
            ],
            "practitioner": {"reference": "Practitioner/practitioner-pharm-janssen", "display": "Hendrik Janssen"},
            "organization": {"reference": "Organization/org-apotheek-janssen", "display": "Apotheek Janssen Brussel"},
            "code": [
                {
                    "coding": [
                        {
                            "system": "https://www.ehealth.fgov.be/standards/fhir/core/CodeSystem/cd-hcparty",
                            "code": "orgpharmacy",
                            "display": "Community Pharmacy",
                        }
                    ]
                }
            ],
        },
        {
            "resourceType": "PractitionerRole",
            "id": "role-physician-claes",
            "identifier": [
                {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/nihdi",
                    "value": "19876543001",
                }
            ],
            "practitioner": {"reference": "Practitioner/practitioner-dr-claes", "display": "Dr. Marie Claes"},
            "code": [
                {
                    "coding": [
                        {
                            "system": "https://www.ehealth.fgov.be/standards/fhir/core/CodeSystem/cd-hcparty",
                            "code": "persphysician",
                            "display": "General Physician / GMD Holder",
                        }
                    ]
                }
            ],
        },
        # --- ServiceRequests (Prescriptions) ---
        {
            "resourceType": "ServiceRequest",
            "id": "sr-ciclosporin-001",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20261015-0001",
                }
            ],
            "status": "active",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "1406183",
                        "display": "Neoral 100 mg/ml drank 50 ml",
                    }
                ],
                "text": "Ciclosporin (Neoral 100 mg/mL oral solution) - 1 bottle of 50 mL",
            },
            "quantityQuantity": {"value": 1, "unit": "bottle"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "occurrencePeriod": {
                "start": "2026-10-15T00:00:00Z",
                "end": "2027-01-15T23:59:59Z",
            },
            "authoredOn": "2026-10-15T07:30:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
                "display": "Dr. Jean Dupont",
            },
            "note": [{"text": "75 mg (0.75 mL) twice daily by oral syringe. GVHD prophylaxis post-HSCT; trough-guided."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-paracetamol-002",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20260810-0002",
                }
            ],
            "status": "completed",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "2213547",
                        "display": "Dafalgan Pediatrie 30 mg/ml drank 90 ml",
                    }
                ],
                "text": "Paracetamol (Dafalgan Pediatrie 30 mg/mL) - 1 bottle of 90 mL",
            },
            "quantityQuantity": {"value": 1, "unit": "bottle"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "occurrencePeriod": {
                "start": "2026-08-10T00:00:00Z",
                "end": "2026-11-10T23:59:59Z",
            },
            "authoredOn": "2026-08-10T09:15:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
                "display": "Dr. Jean Dupont",
            },
            "note": [{"text": "360 mg (12 mL) every 6 h as needed, max 4 doses per day."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-ibuprofen-003",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20260930-0003",
                }
            ],
            "status": "cancelled",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "3029314",
                        "display": "Nurofen 20 mg/ml suspensie 100 ml",
                    }
                ],
                "text": "Ibuprofen (Nurofen 20 mg/mL oral suspension)",
            },
            "quantityQuantity": {"value": 1, "unit": "bottle"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1002-marc-willems",
                }
            },
            "authoredOn": "2026-09-30T14:00:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-claes",
                "display": "Dr. Marie Claes",
            },
            "note": [{"text": "Cancelled - avoid NSAIDs while platelets < 50 x10^9/L during induction."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-dexamethasone-004",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20260929-0004",
                }
            ],
            "status": "stopped",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "4120876",
                        "display": "Dexamethason 1 mg/ml drank 100 ml",
                    }
                ],
                "text": "Dexamethasone 1 mg/mL oral solution",
            },
            "quantityQuantity": {"value": 1, "unit": "bottle"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1002-marc-willems",
                }
            },
            "occurrencePeriod": {
                "start": "2026-09-29T00:00:00Z",
                "end": "2026-10-27T23:59:59Z",
            },
            "authoredOn": "2026-09-29T10:00:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-claes",
                "display": "Dr. Marie Claes",
            },
            "note": [{"text": "1.6 mg twice daily. Induction course completed; prednisolone taper follows."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-omeprazole-005",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20260820-0005",
                }
            ],
            "status": "active",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "0345678",
                        "display": "Omeprazol Sandoz 20mg caps 28",
                    }
                ],
                "text": "Omeprazole 20mg",
            },
            "quantityQuantity": {"value": 1, "unit": "package"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1003-elena-vandenberg",
                }
            },
            "occurrencePeriod": {
                "start": "2026-08-20T00:00:00Z",
                "end": "2027-02-20T23:59:59Z",
            },
            "authoredOn": "2026-08-20T11:20:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
                "display": "Dr. Jean Dupont",
            },
            "note": [{"text": "20 mg once daily - gastric protection on corticosteroids."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-atovaquone-007",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20260905-0007",
                }
            ],
            "status": "active",
            "intent": "order",
            "priority": "routine",
            "code": {
                "coding": [
                    {
                        "system": "https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/ampp",
                        "code": "2894415",
                        "display": "Wellvone 750 mg/5 ml suspensie 226 ml",
                    }
                ],
                "text": "Atovaquone (Wellvone 750 mg/5 mL oral suspension) - 1 bottle",
            },
            "quantityQuantity": {"value": 1, "unit": "bottle"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1003-elena-vandenberg",
                }
            },
            "occurrencePeriod": {
                "start": "2026-09-05T00:00:00Z",
                "end": "2027-03-05T23:59:59Z",
            },
            "authoredOn": "2026-09-05T09:00:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
                "display": "Dr. Jean Dupont",
            },
            "note": [{"text": "1500 mg (10 mL) once daily with food. PJP prophylaxis - cotrimoxazole not tolerated."}],
        },
        {
            "resourceType": "ServiceRequest",
            "id": "sr-mercaptopurine-006",
            "identifier": [
                {
                    "system": "http://ehealth.fgov.be/standards/fhir/medication/NamingSystem/be-ns-prescription",
                    "value": "BE-RECIPE-20261029-0006",
                }
            ],
            "status": "draft",
            "intent": "order",
            "priority": "urgent",
            "code": {
                "coding": [
                    {
                        "system": "https://www.uzgent.be/standards/fhir/medication/magistral-code",
                        "code": "!PURI",
                        "display": "Mercaptopurine suspensie 10mg/ml (100ml) [UZ Gent !PURI]",
                    }
                ],
                "text": "!PURI Mercaptopurine susp 10mg/ml (100ml) — 35 mg (3.5 mL) PO 1x/dag",
            },
            "quantityQuantity": {"value": 1, "unit": "flacon 100ml", "system": "http://unitsofmeasure.org", "code": "mL"},
            "subject": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "occurrencePeriod": {
                "start": "2026-10-29T00:00:00Z",
                "end": "2027-01-29T23:59:59Z",
            },
            "authoredOn": "2026-10-29T08:15:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
                "display": "Dr. Jean Dupont (Drafted by Pediatric Resident)",
            },
            "note": [
                {
                    "text": "ALL Maintenance therapy (50 mg/m²/day on BSA 0.70 m² = 35 mg = 3.5 mL PO once daily in the evening without dairy). Requires supervisor co-signature."
                }
            ],
        },
        # --- Tasks (Fulfillment tracking) ---
        {
            "resourceType": "Task",
            "id": "task-dispense-006",
            "status": "requested",
            "intent": "order",
            "priority": "urgent",
            "focus": {
                "reference": "ServiceRequest/sr-mercaptopurine-006",
                "display": "Draft Prescription for !PURI Mercaptopurine 10mg/ml",
            },
            "for": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "authoredOn": "2026-10-29T08:15:00Z",
            "lastModified": "2026-10-29T08:15:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
            },
        },
        {
            "resourceType": "Task",
            "id": "task-dispense-001",
            "status": "requested",
            "intent": "order",
            "priority": "routine",
            "focus": {
                "reference": "ServiceRequest/sr-ciclosporin-001",
                "display": "Prescription for Neoral 100 mg/mL oral solution",
            },
            "for": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "authoredOn": "2026-10-15T07:30:00Z",
            "lastModified": "2026-10-15T07:30:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
            },
        },
        {
            "resourceType": "Task",
            "id": "task-dispense-002",
            "status": "completed",
            "intent": "order",
            "priority": "routine",
            "focus": {
                "reference": "ServiceRequest/sr-paracetamol-002",
                "display": "Prescription for Dafalgan Pediatrie 30 mg/mL",
            },
            "for": {
                "identifier": {
                    "system": "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin",
                    "value": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe",
                }
            },
            "authoredOn": "2026-08-10T09:15:00Z",
            "lastModified": "2026-08-10T16:45:00Z",
            "requester": {
                "reference": "PractitionerRole/role-physician-dupont",
            },
            "owner": {
                "reference": "PractitionerRole/role-pharmacy-janssen",
                "display": "Apotheek Janssen Brussel",
            },
            "executionPeriod": {
                "start": "2026-08-10T16:40:00Z",
                "end": "2026-08-10T16:45:00Z",
            },
        },
        # --- GraphDefinition ---
        {
            "resourceType": "GraphDefinition",
            "id": "service-request-graph",
            "url": "https://www.ehealth.fgov.be/standards/fhir/uhmep/GraphDefinition/service-request-graph",
            "name": "UHMEPServiceRequestGraph",
            "status": "active",
            "start": "ServiceRequest",
            "link": [
                {
                    "path": "ServiceRequest.requester",
                    "target": [{"type": "PractitionerRole"}],
                },
                {
                    "path": "ServiceRequest.subject",
                    "target": [{"type": "Patient"}],
                },
                {
                    "path": "Task.focus",
                    "target": [{"type": "Task"}],
                },
            ],
        },
        # --- OperationDefinition ---
        {
            "resourceType": "OperationDefinition",
            "id": "servicerequest-graph",
            "url": "https://www.ehealth.fgov.be/standards/fhir/uhmep/OperationDefinition/servicerequest-graph",
            "name": "ServiceRequestGraph",
            "status": "active",
            "kind": "operation",
            "code": "graph",
            "resource": ["ServiceRequest"],
            "system": False,
            "type": False,
            "instance": True,
            "parameter": [
                {"name": "graph", "use": "in", "min": 0, "max": "1", "type": "string"},
                {"name": "return", "use": "out", "min": 1, "max": "1", "type": "Bundle"},
            ],
        },
        {
            "resourceType": "OperationDefinition",
            "id": "servicerequest-approve",
            "url": "https://www.ehealth.fgov.be/standards/fhir/uhmep/OperationDefinition/servicerequest-approve",
            "name": "ServiceRequestApprove",
            "status": "active",
            "kind": "operation",
            "code": "approve",
            "resource": ["ServiceRequest"],
            "system": False,
            "type": False,
            "instance": True,
        },
        {
            "resourceType": "OperationDefinition",
            "id": "servicerequest-reject",
            "url": "https://www.ehealth.fgov.be/standards/fhir/uhmep/OperationDefinition/servicerequest-reject",
            "name": "ServiceRequestReject",
            "status": "active",
            "kind": "operation",
            "code": "reject",
            "resource": ["ServiceRequest"],
            "system": False,
            "type": False,
            "instance": True,
        },
    ]

    for item in fixtures:
        save_resource(item["resourceType"], item["id"], item, conn=conn)


# -----------------------------------------------------------------------------
# FHIR Helpers & OperationOutcome Generators
# -----------------------------------------------------------------------------
def make_operation_outcome(
    severity: str,
    code: str,
    error_code: str,
    diagnostics: str,
    status_code: int = 400,
) -> JSONResponse:
    outcome = {
        "resourceType": "OperationOutcome",
        "issue": [
            {
                "severity": severity,
                "code": code,
                "details": {
                    "coding": [
                        {
                            "system": ERROR_SYSTEM,
                            "code": error_code,
                        }
                    ]
                },
                "diagnostics": diagnostics,
            }
        ],
    }
    return JSONResponse(
        status_code=status_code,
        content=outcome,
        media_type=FHIR_JSON_MEDIA_TYPE,
    )


def make_bundle(resources: List[Dict[str, Any]], bundle_type: str = "searchset") -> Dict[str, Any]:
    entries = []
    for res in resources:
        entries.append(
            {
                "fullUrl": f"urn:uuid:{res.get('id', str(uuid.uuid4()))}",
                "resource": res,
            }
        )
    return {
        "resourceType": "Bundle",
        "type": bundle_type,
        "total": len(resources),
        "entry": entries,
    }


def parse_search_body(body_bytes: bytes) -> Dict[str, str]:
    """Parses form-encoded or JSON search parameters from raw request body."""
    if not body_bytes:
        return {}
    body_str = body_bytes.decode("utf-8", errors="ignore").strip()
    if not body_str:
        return {}

    # Try JSON
    if body_str.startswith("{"):
        try:
            parsed = json.loads(body_str)
            if isinstance(parsed, dict):
                return {k: str(v) for k, v in parsed.items()}
        except Exception:
            pass

    # Try form-urlencoded / query string format
    params: Dict[str, str] = {}
    for part in body_str.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip()] = v.strip()
    return params


# -----------------------------------------------------------------------------
# FastAPI App Initialization
# -----------------------------------------------------------------------------
app = FastAPI(
    title="UHMEP (Referral Prescription) FHIR Mock API",
    description="""
### Belgian eHealth UHMEP & Recip-e FHIR Mock API Server

This server provides an interactive, fully functional local mock environment for hackathon participants.
It implements the Belgian eHealth UHMEP v1.4 OpenAPI specification and Recip-e FHIR Prescription workflows.

#### Key Features:
* **Interactive Sandbox**: Create, query, search, update, approve, and reject prescriptions.
* **Pre-seeded Fixtures**: Real-world sample data for physicians, pharmacies, patients, active/completed prescriptions, and tasks.
* **Role Simulation**: Switch roles effortlessly with `X-Role: prescriber | caregiver | patient | organization`.
* **Zero Config**: All endpoints run out of the box with zero auth barriers.
* **Reset Anytime**: Hit `POST /fixtures/reset` to restore clean fixture state.
    """,
    version="1.4",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    default_response_class=JSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_uhmep_headers(request: Request, call_next):
    # Correlation ID
    req_corr_id = request.headers.get("correlation-id") or str(uuid.uuid4())
    # Accept-Be-Pseudo negotiation
    accept_pseudo = request.headers.get("accept-be-pseudo", DEFAULT_PSEUDO_VERSION)
    content_pseudo = accept_pseudo if accept_pseudo in ["urn:be:fgov:ehealth:pseudo:v1", "urn:be:fgov:ehealth:pseudo:v2"] else DEFAULT_PSEUDO_VERSION

    response = await call_next(request)
    response.headers["Correlation-Id"] = req_corr_id
    response.headers["Content-Be-Pseudo"] = content_pseudo
    return response


# -----------------------------------------------------------------------------
# System Level Operations
# -----------------------------------------------------------------------------
@app.get(
    "/metadata",
    summary="server-capabilities: Fetch the server FHIR CapabilityStatement",
    tags=["System Level Operations"],
)
def get_metadata():
    """Returns the server FHIR CapabilityStatement defining supported resources and operations."""
    return {
        "resourceType": "CapabilityStatement",
        "id": "uhmep-mock-capability-statement",
        "version": "1.4",
        "name": "UHMEPMockCapabilityStatement",
        "title": "UHMEP (Referral Prescription) FHIR Mock Server Capabilities",
        "status": "active",
        "date": "2026-08-21",
        "publisher": "eHealth Platform Belgium / Hackathon Mock",
        "kind": "instance",
        "software": {"name": "UHMEP-FHIR-Mock", "version": "1.4.0"},
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "application/json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": "ServiceRequest",
                        "profile": "https://www.ehealth.fgov.be/standards/fhir/medication/StructureDefinition/be-medication-prescription",
                        "interaction": [
                            {"code": "read"},
                            {"code": "create"},
                            {"code": "patch"},
                            {"code": "search-type"},
                        ],
                        "operation": [
                            {"name": "graph", "definition": "OperationDefinition/servicerequest-graph"},
                            {"name": "approve", "definition": "OperationDefinition/servicerequest-approve"},
                            {"name": "reject", "definition": "OperationDefinition/servicerequest-reject"},
                        ],
                        "searchParam": [
                            {"name": "patient", "type": "reference"},
                            {"name": "requester", "type": "reference"},
                            {"name": "status", "type": "token"},
                            {"name": "authored-on", "type": "date"},
                        ],
                    },
                    {
                        "type": "Task",
                        "profile": "https://www.ehealth.fgov.be/standards/fhir/drp/StructureDefinition/be-performer-task",
                        "interaction": [
                            {"code": "read"},
                            {"code": "create"},
                            {"code": "patch"},
                            {"code": "delete"},
                            {"code": "search-type"},
                        ],
                        "searchParam": [
                            {"name": "focus", "type": "reference"},
                            {"name": "_profile", "type": "uri"},
                            {"name": "status", "type": "token"},
                        ],
                    },
                    {
                        "type": "Practitioner",
                        "interaction": [{"code": "read"}, {"code": "create"}],
                    },
                    {
                        "type": "PractitionerRole",
                        "interaction": [{"code": "read"}],
                    },
                    {
                        "type": "Organization",
                        "interaction": [{"code": "read"}],
                    },
                    {
                        "type": "GraphDefinition",
                        "interaction": [{"code": "read"}],
                    },
                    {
                        "type": "OperationDefinition",
                        "interaction": [{"code": "read"}],
                    },
                ],
            }
        ],
    }


# -----------------------------------------------------------------------------
# GraphDefinition & OperationDefinition Endpoints
# -----------------------------------------------------------------------------
@app.get(
    "/GraphDefinition/{id}",
    summary="read-instance: Read GraphDefinition instance",
    tags=["GraphDefinition"],
)
def get_graph_definition(id: str):
    res = load_resource("GraphDefinition", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="GRAPH_DEFINITION_NOT_FOUND",
            diagnostics=f"GraphDefinition with ID '{id}' was not found.",
            status_code=404,
        )
    return res


@app.get(
    "/OperationDefinition/{id}",
    summary="read-instance: Read OperationDefinition instance",
    tags=["OperationDefinition"],
)
def get_operation_definition(id: str):
    res = load_resource("OperationDefinition", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="OPERATION_DEFINITION_NOT_FOUND",
            diagnostics=f"OperationDefinition with ID '{id}' was not found.",
            status_code=404,
        )
    return res


# -----------------------------------------------------------------------------
# Practitioner & PractitionerRole Endpoints
# -----------------------------------------------------------------------------
@app.get(
    "/Practitioner/{id}",
    summary="read-instance: Read Practitioner instance",
    tags=["Practitioner"],
)
def get_practitioner(id: str):
    res = load_resource("Practitioner", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRACTITIONER_NOT_FOUND",
            diagnostics=f"Practitioner with ID '{id}' not found.",
            status_code=404,
        )
    return res


@app.post(
    "/Practitioner",
    status_code=status.HTTP_201_CREATED,
    summary="create-type: Create a new Practitioner instance",
    tags=["Practitioner"],
)
def create_practitioner(payload: Dict[str, Any] = Body(...)):
    res_id = payload.get("id") or f"practitioner-{uuid.uuid4().hex[:8]}"
    payload["resourceType"] = "Practitioner"
    payload["id"] = res_id
    saved = save_resource("Practitioner", res_id, payload)
    return JSONResponse(status_code=201, content=saved, headers={"Location": f"/Practitioner/{res_id}"})


@app.get(
    "/PractitionerRole/{id}",
    summary="read-instance: Read PractitionerRole instance",
    tags=["PractitionerRole"],
)
def get_practitioner_role(id: str):
    res = load_resource("PractitionerRole", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRACTITIONER_ROLE_NOT_FOUND",
            diagnostics=f"PractitionerRole with ID '{id}' not found.",
            status_code=404,
        )
    return res


# -----------------------------------------------------------------------------
# Organization Endpoints
# -----------------------------------------------------------------------------
@app.get(
    "/Organization/{id}",
    summary="read-instance: Read Organization instance",
    tags=["Organization"],
)
def get_organization(id: str):
    res = load_resource("Organization", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="ORGANIZATION_NOT_FOUND",
            diagnostics=f"Organization with ID '{id}' not found.",
            status_code=404,
        )
    return res


# -----------------------------------------------------------------------------
# Custom Graph Helper
# -----------------------------------------------------------------------------
def build_service_request_graph(sr_id: str) -> Optional[Dict[str, Any]]:
    sr = load_resource("ServiceRequest", sr_id)
    if not sr:
        return None

    bundle_resources = [sr]
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find associated PractitionerRole and Practitioner
    requester_ref = sr.get("requester", {}).get("reference")
    if requester_ref and "/" in requester_ref:
        r_type, r_id = requester_ref.split("/", 1)
        role = load_resource(r_type, r_id, conn)
        if role:
            bundle_resources.append(role)
            p_ref = role.get("practitioner", {}).get("reference")
            if p_ref and "/" in p_ref:
                p_type, p_id = p_ref.split("/", 1)
                practitioner = load_resource(p_type, p_id, conn)
                if practitioner:
                    bundle_resources.append(practitioner)

            org_ref = role.get("organization", {}).get("reference")
            if org_ref and "/" in org_ref:
                o_type, o_id = org_ref.split("/", 1)
                org = load_resource(o_type, o_id, conn)
                if org:
                    bundle_resources.append(org)

    # Find associated Tasks
    cursor.execute(
        "SELECT data FROM resources WHERE resource_type = 'Task' AND (data LIKE ? OR subject LIKE ?) AND is_deleted = 0",
        (f"%ServiceRequest/{sr_id}%", f"%{sr_id}%"),
    )
    for row in cursor.fetchall():
        task_data = json.loads(row["data"])
        bundle_resources.append(task_data)
        owner_ref = task_data.get("owner", {}).get("reference")
        if owner_ref and "/" in owner_ref:
            o_type, o_id = owner_ref.split("/", 1)
            owner_res = load_resource(o_type, o_id, conn)
            if owner_res and owner_res not in bundle_resources:
                bundle_resources.append(owner_res)

    conn.close()
    return make_bundle(bundle_resources, bundle_type="collection")


# -----------------------------------------------------------------------------
# ServiceRequest Endpoints
# -----------------------------------------------------------------------------
@app.get(
    "/ServiceRequest/{id}/$graph",
    summary="This operation returns a graph of the service request (GET)",
    tags=["ServiceRequest"],
)
def get_service_request_graph(id: str, graph: Optional[str] = Query(None)):
    bundle = build_service_request_graph(id)
    if not bundle:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"Cannot generate graph: ServiceRequest '{id}' does not exist.",
            status_code=404,
        )
    return bundle


@app.post(
    "/ServiceRequest/{id}/$graph",
    summary="This operation returns a graph of the service request (POST)",
    tags=["ServiceRequest"],
)
def post_service_request_graph(id: str, payload: Optional[Dict[str, Any]] = Body(None)):
    bundle = build_service_request_graph(id)
    if not bundle:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"Cannot generate graph: ServiceRequest '{id}' does not exist.",
            status_code=404,
        )
    return bundle


@app.post(
    "/ServiceRequest/{id}/$approve",
    summary="This operation approves a ServiceRequest",
    tags=["ServiceRequest"],
)
def approve_service_request(id: str, request: Request, payload: Optional[Dict[str, Any]] = Body(None)):
    role = (request.headers.get("x-role") or "").lower().strip()
    if role == "assistant" or role == "patient":
        return make_operation_outcome(
            severity="error",
            code="forbidden",
            error_code="INSUFFICIENT_ROLE_PRIVILEGES",
            diagnostics=f"Role '{role}' is not authorized to execute $approve on ServiceRequest '{id}'. Requires supervising pediatric oncologist ('supervisor' or 'prescriber') with valid 11-digit NIHII.",
            status_code=403,
        )

    sr = load_resource("ServiceRequest", id)
    if not sr:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"ServiceRequest '{id}' not found to approve.",
            status_code=404,
        )

    sr["status"] = "active"
    if "meta" not in sr:
        sr["meta"] = {}
    if "extension" not in sr:
        sr["extension"] = []

    sr["extension"].append(
        {
            "url": "https://www.ehealth.fgov.be/standards/fhir/uhmep/StructureDefinition/be-ext-approval",
            "valueBoolean": True,
            "valueDateTime": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "valueString": "Approved by Supervising Pediatric Oncologist (NIHII: 19766016004)",
        }
    )
    saved = save_resource("ServiceRequest", id, sr)
    return saved


@app.post(
    "/ServiceRequest/{id}/$reject",
    summary="This operation rejects a ServiceRequest",
    tags=["ServiceRequest"],
)
def reject_service_request(id: str, request: Request, payload: Optional[Dict[str, Any]] = Body(None)):
    role = (request.headers.get("x-role") or "").lower().strip()
    if role == "assistant" or role == "patient":
        return make_operation_outcome(
            severity="error",
            code="forbidden",
            error_code="INSUFFICIENT_ROLE_PRIVILEGES",
            diagnostics=f"Role '{role}' is not authorized to execute $reject on ServiceRequest '{id}'. Requires supervising physician.",
            status_code=403,
        )

    sr = load_resource("ServiceRequest", id)
    if not sr:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"ServiceRequest '{id}' not found to reject.",
            status_code=404,
        )

    sr["status"] = "revoked"
    saved = save_resource("ServiceRequest", id, sr)
    return saved


@app.post(
    "/ServiceRequest/_search",
    summary="search-type: Search for ServiceRequest instances",
    tags=["ServiceRequest"],
)
async def search_service_requests(
    request: Request,
    patient: Optional[str] = Query(None),
    requester: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    _count: int = Query(25),
    _offset: int = Query(0),
):
    body_bytes = await request.body()
    body_params = parse_search_body(body_bytes)

    param_patient = patient or body_params.get("patient") or body_params.get("patient:identifier")
    param_requester = requester or body_params.get("requester")
    param_status = status or body_params.get("status")
    param_count = int(body_params.get("_count", _count))
    param_offset = int(body_params.get("_offset", _offset))

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT data FROM resources WHERE resource_type = 'ServiceRequest' AND is_deleted = 0"
    args: List[Any] = []

    if param_status:
        query += " AND status = ?"
        args.append(param_status)

    if param_patient:
        query += " AND (subject LIKE ? OR data LIKE ?)"
        args.append(f"%{param_patient}%")
        args.append(f"%{param_patient}%")

    if param_requester:
        query += " AND (requester LIKE ? OR data LIKE ?)"
        args.append(f"%{param_requester}%")
        args.append(f"%{param_requester}%")

    query += " ORDER BY created_at DESC"
    cursor.execute(query, args)
    rows = cursor.fetchall()
    conn.close()

    all_results = [json.loads(r["data"]) for r in rows]
    paginated = all_results[param_offset : param_offset + param_count]
    return make_bundle(paginated)


@app.get(
    "/ServiceRequest/{id}",
    summary="read-instance: Read ServiceRequest instance",
    tags=["ServiceRequest"],
)
def get_service_request(id: str):
    res = load_resource("ServiceRequest", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="business-rule",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"Prescription / ServiceRequest '{id}' not found.",
            status_code=404,
        )
    return res


@app.post(
    "/ServiceRequest",
    status_code=status.HTTP_201_CREATED,
    summary="create-type: Create a new ServiceRequest instance",
    tags=["ServiceRequest"],
)
def create_service_request(payload: Dict[str, Any] = Body(...)):
    res_id = payload.get("id") or f"sr-{uuid.uuid4().hex[:8]}"
    payload["resourceType"] = "ServiceRequest"
    payload["id"] = res_id
    payload.setdefault("status", "active")
    payload.setdefault("intent", "order")
    payload.setdefault("priority", "routine")
    payload.setdefault("authoredOn", datetime.datetime.now(datetime.timezone.utc).isoformat())

    saved = save_resource("ServiceRequest", res_id, payload)

    # Auto-create associated Task for fulfillment
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    task_payload = {
        "resourceType": "Task",
        "id": task_id,
        "status": "requested",
        "intent": "order",
        "priority": "routine",
        "focus": {"reference": f"ServiceRequest/{res_id}"},
        "for": payload.get("subject"),
        "authoredOn": payload["authoredOn"],
        "requester": payload.get("requester"),
    }
    save_resource("Task", task_id, task_payload)

    return JSONResponse(
        status_code=201,
        content=saved,
        headers={"Location": f"/ServiceRequest/{res_id}"},
    )


@app.patch(
    "/ServiceRequest/{id}",
    summary="instance-patch: Patch a resource instance of type ServiceRequest by ID",
    tags=["ServiceRequest"],
)
def patch_service_request(id: str, patch_data: Dict[str, Any] = Body(...)):
    existing = load_resource("ServiceRequest", id)
    if not existing:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="PRESCRIPTION_NOT_FOUND",
            diagnostics=f"ServiceRequest '{id}' not found for patch.",
            status_code=404,
        )

    if patch_data.get("resourceType") == "Parameters" and "parameter" in patch_data:
        for param in patch_data["parameter"]:
            parts = {p.get("name"): p.get("valueString") or p.get("value") or p.get("valueDate") for p in param.get("part", [])}
            name = parts.get("name")
            value = parts.get("value")
            if name:
                existing[name] = value
    else:
        for k, v in patch_data.items():
            if k not in ["resourceType", "id"]:
                existing[k] = v

    saved = save_resource("ServiceRequest", id, existing)
    return saved


# -----------------------------------------------------------------------------
# Task Endpoints (Fulfillment & Dispensing)
# -----------------------------------------------------------------------------
@app.post(
    "/Task/_search",
    summary="search-type: Search for Task instances (POST)",
    tags=["Task"],
)
async def search_tasks(
    request: Request,
    focus: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    _count: int = Query(25),
    _offset: int = Query(0),
):
    body_bytes = await request.body()
    body_params = parse_search_body(body_bytes)

    param_focus = focus or body_params.get("focus")
    param_status = status or body_params.get("status")
    param_count = int(body_params.get("_count", _count))
    param_offset = int(body_params.get("_offset", _offset))

    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT data FROM resources WHERE resource_type = 'Task' AND is_deleted = 0"
    args = []

    if param_status:
        query += " AND status = ?"
        args.append(param_status)

    if param_focus:
        query += " AND data LIKE ?"
        args.append(f"%{param_focus}%")

    query += " ORDER BY created_at DESC"
    cursor.execute(query, args)
    rows = cursor.fetchall()
    conn.close()

    results = [json.loads(r["data"]) for r in rows]
    return make_bundle(results[param_offset : param_offset + param_count])


@app.get(
    "/Task",
    summary="search-type: Search for Task instances (GET)",
    tags=["Task"],
)
def get_tasks(
    focus: Optional[str] = Query(None, description="Filters Tasks by the Task.focus reference (e.g. ServiceRequest/123)"),
    _profile: Optional[str] = Query(None, description="Filters Tasks conforming to a FHIR Profile"),
    status: Optional[str] = Query(None),
    _count: int = Query(25),
    _offset: int = Query(0),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT data FROM resources WHERE resource_type = 'Task' AND is_deleted = 0"
    args = []

    if status:
        query += " AND status = ?"
        args.append(status)

    if focus:
        query += " AND data LIKE ?"
        args.append(f"%{focus}%")

    query += " ORDER BY created_at DESC"
    cursor.execute(query, args)
    rows = cursor.fetchall()
    conn.close()

    results = [json.loads(r["data"]) for r in rows]
    return make_bundle(results[_offset : _offset + _count])


@app.post(
    "/Task",
    status_code=status.HTTP_201_CREATED,
    summary="create-type: Create a new Task instance",
    tags=["Task"],
)
def create_task(payload: Dict[str, Any] = Body(...)):
    res_id = payload.get("id") or f"task-{uuid.uuid4().hex[:8]}"
    payload["resourceType"] = "Task"
    payload["id"] = res_id
    payload.setdefault("status", "requested")
    payload.setdefault("intent", "order")
    payload.setdefault("authoredOn", datetime.datetime.now(datetime.timezone.utc).isoformat())

    saved = save_resource("Task", res_id, payload)
    return JSONResponse(status_code=201, content=saved, headers={"Location": f"/Task/{res_id}"})


@app.get(
    "/Task/{id}",
    summary="read-instance: Read Task instance",
    tags=["Task"],
)
def get_task(id: str):
    res = load_resource("Task", id)
    if not res:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="TASK_NOT_FOUND",
            diagnostics=f"Task with ID '{id}' not found.",
            status_code=404,
        )
    return res


@app.patch(
    "/Task/{id}",
    summary="instance-patch: Patch a resource instance of type Task by ID",
    tags=["Task"],
)
def patch_task(id: str, patch_data: Dict[str, Any] = Body(...)):
    existing = load_resource("Task", id)
    if not existing:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="TASK_NOT_FOUND",
            diagnostics=f"Task with ID '{id}' not found for update.",
            status_code=404,
        )

    for k, v in patch_data.items():
        if k not in ["resourceType", "id"]:
            existing[k] = v

    # When a task is completed, update linked ServiceRequest to completed
    if existing.get("status") == "completed":
        focus_ref = existing.get("focus", {}).get("reference")
        if focus_ref and focus_ref.startswith("ServiceRequest/"):
            sr_id = focus_ref.split("/", 1)[1]
            sr = load_resource("ServiceRequest", sr_id)
            if sr:
                sr["status"] = "completed"
                save_resource("ServiceRequest", sr_id, sr)

    saved = save_resource("Task", id, existing)
    return saved


@app.delete(
    "/Task/{id}",
    summary="instance-delete: Perform a logical delete on a resource instance",
    tags=["Task"],
)
def delete_task(id: str):
    success = delete_resource_logic("Task", id)
    if not success:
        return make_operation_outcome(
            severity="error",
            code="not-found",
            error_code="TASK_NOT_FOUND",
            diagnostics=f"Task with ID '{id}' not found for deletion.",
            status_code=404,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# MedicationRequest Compatibility Aliases
# -----------------------------------------------------------------------------
@app.post(
    "/MedicationRequest/_search",
    summary="MedicationRequest compatibility alias -> search ServiceRequests",
    tags=["MedicationRequest (Compatibility Alias)"],
)
async def alias_search_medication_requests(
    request: Request,
    patient: Optional[str] = Query(None),
    requester: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    _count: int = Query(25),
    _offset: int = Query(0),
):
    return await search_service_requests(request, patient, requester, status, _count, _offset)


@app.get(
    "/MedicationRequest/{id}/$graph",
    summary="MedicationRequest compatibility alias -> graph ServiceRequest",
    tags=["MedicationRequest (Compatibility Alias)"],
)
def alias_get_medication_request_graph(id: str, graph: Optional[str] = Query(None)):
    return get_service_request_graph(id, graph)


@app.post(
    "/MedicationRequest",
    status_code=status.HTTP_201_CREATED,
    summary="MedicationRequest compatibility alias -> create ServiceRequest",
    tags=["MedicationRequest (Compatibility Alias)"],
)
def alias_create_medication_request(payload: Dict[str, Any] = Body(...)):
    return create_service_request(payload)


@app.get(
    "/MedicationRequest/{id}",
    summary="MedicationRequest compatibility alias -> read ServiceRequest",
    tags=["MedicationRequest (Compatibility Alias)"],
)
def alias_get_medication_request(id: str):
    return get_service_request(id)


@app.patch(
    "/MedicationRequest/{id}",
    summary="MedicationRequest compatibility alias -> patch ServiceRequest",
    tags=["MedicationRequest (Compatibility Alias)"],
)
def alias_patch_medication_request(id: str, patch_data: Dict[str, Any] = Body(...)):
    return patch_service_request(id, patch_data)


# -----------------------------------------------------------------------------
# Admin & Fixtures Helper Endpoints
# -----------------------------------------------------------------------------
@app.post(
    "/fixtures/reset",
    summary="Reset database and restore default test fixtures",
    tags=["Admin & Fixtures"],
)
def reset_fixtures_endpoint():
    """Resets the SQLite database and re-seeds all default Belgian healthcare fixtures."""
    init_db(force_reset=True)
    return {
        "status": "success",
        "message": "Database successfully reset and pre-populated with standard Belgian FHIR fixtures.",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


@app.get(
    "/fixtures/summary",
    summary="Get summary of available fixtures and sample IDs",
    tags=["Admin & Fixtures"],
)
def get_fixtures_summary():
    """Lists available pre-seeded records to make testing and hacking straightforward."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT resource_type, id, status, updated_at FROM resources WHERE is_deleted = 0 ORDER BY resource_type, id")
    rows = cursor.fetchall()
    conn.close()

    summary: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        r_type = r["resource_type"]
        summary.setdefault(r_type, []).append({"id": r["id"], "status": r["status"]})

    return {
        "total_resources": len(rows),
        "resources_by_type": summary,
        "sample_identities": {
            "physician": {"nihii": "19766016004", "ssin": "90010212345", "role": "PractitionerRole/role-physician-dupont"},
            "pharmacist": {"nihii": "20017534001", "ssin": "88072034567", "role": "PractitionerRole/role-pharmacy-janssen"},
            "patient_1": {"pseudo": "urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe"},
            "patient_2": {"pseudo": "urn:be:fgov:ehealth:pseudo:v1:pat-1002-marc-willems"},
        },
    }


@app.get("/healthz", summary="Health check", tags=["Admin & Fixtures"])
def health_check():
    return {"status": "ok", "service": "uhmep-mock-server"}


# -----------------------------------------------------------------------------
# CLI Runner & Main Entrypoint
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="UHMEP FHIR Mock Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--db", default=DEFAULT_DB_FILE, help=f"SQLite database file path (default: {DEFAULT_DB_FILE})")
    parser.add_argument("--reset-db", action="store_true", help="Force reset and re-seed database fixtures on start")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    args = parser.parse_args()

    # Initialize DB
    init_db(db_path=args.db, force_reset=args.reset_db)

    print("\n" + "=" * 65)
    print(" 🏥 UHMEP (Referral Prescription) FHIR Mock API Server")
    print("=" * 65)
    print(f" • Server URL:     http://{args.host}:{args.port}")
    print(f" • Interactive UI: http://localhost:{args.port}/docs")
    print(f" • ReDoc UI:       http://localhost:{args.port}/redoc")
    print(f" • OpenAPI JSON:   http://localhost:{args.port}/openapi.json")
    print(f" • Database File:  {os.path.abspath(args.db)}")
    print("=" * 65 + "\n")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
