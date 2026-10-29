# PediDose — Pediatric Hemato-Oncology Safe Prescribing, Magistral & Caregiver Platform

**PediDose** is a clinical decision support, multi-role prescribing workflow, and caregiver companion web application built for **Use Case 2 (Pediatric Medication Prescription)** on top of the **Belgian UHMEP v1.4 (Use Cases for Hospital Medication E-Prescribing) / Recip-e FHIR R4** standard.

This folder (`pedidose-app/`) is completely self-contained for GitHub and cloud deployment, bundling both:
- **Frontend (`src/`)**: React 19 + TypeScript + Vite + Tailwind CSS v4 clinical application
- **Backend (`mock-api-server/server.py`)**: FastAPI Belgian UHMEP v1.4 FHIR R4 Mock Server

---

## Key Clinical & Regulatory Features

1. **Deterministic Pediatric Dosing & High-Alert Safety Guardrails (No Generative Math)**
   - **Mosteller BSA Engine**: $\text{BSA (m}^2) = \sqrt{\frac{\text{Height (cm)} \times \text{Weight (kg)}}{3600}}$ with live editable pediatric vitals.
   - **Hard Ceiling Clamp (Vincristine `2.00 mg`)**: Automatically clamps raw BSA calculations above `2.00 mg` (e.g., `1.5 mg/m²` on `1.66 m²` = `2.49 mg` $\rightarrow$ clamped to `2.00 mg`) to prevent fatal neurotoxicity.
   - **10x Oral Syringe Volume Guardrail**: Detects 10-fold liquid dosing errors (e.g., **Prednisolone** `3.0 mL` vs `0.3 mL` on a `10 mg/mL` solution for a 12 kg toddler) and renders an interactive SVG Purple EnFit oral syringe.
   - **Renal Function (`CrCl`) Interval Adaptation**: Automatically adapts dosing intervals (e.g., **Aciclovir** post-HSCT prophylaxis when $\text{CrCl} \le 50\text{ mL/min}$).

2. **Belgian SAM v2 / CNK, Farmastatus & UZ Gent Magistral (`!CODE`) Integration**
   - Supports commercial Belgian `CNK` packages alongside UZ Gent Hospital Magistral building blocks (`!PREDNI` Prednisolone 5 mg/mL, `!PURI` 6-Mercaptopurine 10 mg/mL, `!OMEPED` Omeprazole 2 mg/mL TMF).

3. **Clinical Trial Medication Sourcing Lock (`HEM-iSmart`)**
   - Blocks commercial Recip-e prescribing for sponsor-provided investigational products (**Ruxolitinib / Jakavi** in `HEM-iSmart`) to prevent €3,200+ improper billing, routing orders directly to the Hospital Clinical Trial Pharmacy IMP stock.

4. **RIZIV Chapter IV vs. Belgian Pediatric Oncology Convention**
   - Flags when **Posaconazole (Noxafil) 40 mg/mL oral suspension** is restricted to the **Belgian Pediatric Oncology Convention** (National Tumor Board) vs. **100 mg gastro-resistant tablets** covered under **RIZIV Chapter IV §4460100 (Bijlage A)**, complete with UZ Gent Clinical Pharmacy PK guidance on crushed tablets in apple purée and an auto-populated **Bijlage A** authorization modal.

5. **Belgian UHMEP v1.4 Multi-Role FHIR Workflow (`server.py`)**
   - Live `X-Role` switcher (`assistant`, `supervisor`, `pharmacist`, `patient`), `Accept-Be-Pseudo: urn:be:fgov:ehealth:pseudo:v1`, and `Correlation-Id` telemetry.
   - Assistant drafts `ServiceRequest` (`status: draft`) $\rightarrow$ Supervisor co-signs via `POST /ServiceRequest/{id}/$approve` (attaching `be-ext-approval`; blocks `X-Role: assistant` with HTTP `403 OperationOutcome`) $\rightarrow$ Pharmacist updates `PATCH /Task/{id}` (`requested` $\rightarrow$ `in-progress` $\rightarrow$ `completed`, which automatically completes the linked `ServiceRequest`).

6. **Caregiver Companion & Self-Learning Pharmacist-Moderated Knowledge Base**
   - Dose-matched home syringe instructions (based on UZ Gent PHO caregiver folders), printable corticosteroid step-down tapering calendar, and community tips with an **AI Traffic-Light Food-Drug Interaction Screener** (flagging grapefruit CYP3A4 conflicts or alkaline milk + Losec MUPS degradation) and Pharmacist moderation gate.

---

## Quickstart (Local Development)

### 1. Start the Belgian UHMEP FHIR R4 Mock Server (`:8000`)

```bash
cd mock-api-server
uv run server.py
# Or using standard Python venv / pip:
# pip install -r requirements.txt
# python3 server.py
```

The FHIR server will listen on `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

### 2. Start the PediDose React + Vite App (`:5173`)

In a second terminal from the root of `pedidose-app/`:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables for Deployment

When deploying the frontend (e.g., Vercel, Netlify, Render, Cloud Run) and the FastAPI backend (`mock-api-server/`):

- Set `VITE_API_URL` on the frontend build to point to your deployed FastAPI server URL (defaults to `http://localhost:8000` in local development).
