# E-2 Case File — Tab Structure (Akalan Standard)

> Calibrated to real Akalan E-2 renewal filings. Tab letters A-L map to
> firm filing convention. This is the **filing-bound** structure — the
> physical/PDF tab order USCIS sees. Internal working folders may add
> intake / correspondence / receipts folders alongside.

---

## Filing Tab Structure (A-L) — what USCIS receives

```
<CaseID>_<BeneficiarySurname_ASCII>_E2_<New|Renewal|COS>/
│
├── TAB-A_Forms/
│   ├── G-1145-e-Notification.pdf
│   ├── G-28-Notice-of-Appearance.pdf
│   ├── I-129-Petition.pdf
│   ├── I-129-E-Supplement.pdf
│   ├── G-1650-ACH-Authorization-Petition-fee.pdf
│   └── G-1650-ACH-Authorization-Filing-fee.pdf
│
├── TAB-B_Cover-Letter/
│   └── Cover-Letter-FINAL.pdf
│
├── TAB-C_Treaty-Qualification/                  ← Element 1 (Nationality)
│   ├── 01_Prior-E-2-Visa.pdf
│   ├── 02_Payroll-Records-Prior-E-2-Employment.pdf  (renewal only)
│   ├── 03_Form-I-94-Arrival-Departure.pdf
│   ├── 04_Beneficiary-Passport-Bio-Page.pdf
│   ├── 05_Membership-Interest-Transfer-Agreement.pdf
│   ├── 06_Member-Resolutions.pdf
│   └── 07_Co-Owner-EAD-Card-or-Nationality-Proof.pdf
│
├── TAB-D_Ownership-Corporate-History/           ← Element 1 (50%) + corporate
│   ├── 01_Articles-of-Organization.pdf
│   ├── 02_Original-Operating-Agreement.pdf
│   ├── 03_Initial-Member-Resolutions.pdf
│   ├── 04_Bill-of-Sale-Prior-Owner-to-Current.pdf
│   └── 05_Membership-Interest-Transfer-Agreement-CURRENT.pdf
│
├── TAB-E_Investment-Source-Transfer-AtRisk/     ← Element 2 + SOF
│   ├── 01_Source-Origin/
│   │   ├── Prior-Title-Deed-2013.pdf
│   │   ├── Current-Title-Deed-2025.pdf
│   │   ├── Bank-Receipts-Property-Sale.pdf
│   │   ├── Bank-Statement-Sale-Proceeds.pdf
│   │   ├── Residential-Lease-Agreement.pdf
│   │   ├── Bank-Receipts-Rental-Income.pdf
│   │   └── Bank-Statement-Rental-Income.pdf
│   ├── 02_Transfer/
│   │   ├── Currency-Conversion-Receipt.pdf
│   │   ├── USD-Transfers-International.pdf
│   │   └── USD-Transfer-Receipt-to-Co-Owner-or-Petitioner.pdf
│   ├── 03_AtRisk-Commitment/
│   │   ├── Membership-Interest-Transfer-Agreement.pdf
│   │   └── Legal-Fee-Invoice.pdf
│   └── _Source-of-Funds-Memo.pdf                ← internal, fed to cover letter
│
├── TAB-F_Substantiality/                        ← Element 2 proportionality
│   ├── 01_Membership-Interest-Transfer-Agreement.pdf
│   ├── 02_Petitioner-Balance-Sheet.pdf
│   └── _Proportionality-Calculation.xlsx        ← internal worksheet
│
├── TAB-G_Marginality-Commercial-Activity/       ← Elements 3 + 4
│   ├── 01_Photographs-Business-Premises.pdf
│   ├── 02_Articles-of-Organization.pdf
│   ├── 03_Commercial-Lease.pdf
│   ├── 04_Business-Bank-Statements.pdf
│   ├── 05_Vendor-Invoices.pdf
│   ├── 06_2024-Federal-Tax-Return.pdf
│   ├── 07_Payroll-Records.pdf
│   └── 08_Business-Plan-5yr.pdf                  ← if marginality on projections
│
├── TAB-H_Develop-and-Direct/                    ← Element 5
│   ├── 01_Beneficiary-Prior-E-2-Visa.pdf
│   ├── 02_Beneficiary-Prior-E-2-Employment-History.pdf
│   ├── 03_Member-Resolution-Appointing-President.pdf
│   ├── 04_Organizational-Chart.pdf
│   ├── 05_Beneficiary-CV.pdf
│   └── 06_Business-Plan.pdf
│
├── TAB-I_NOID-Principal/                        ← Nonimmigrant intent
│   └── Notice-of-Intent-to-Depart-Principal.pdf
│
├── TAB-J_Forms-Dependents/
│   ├── G-1145-Spouse.pdf
│   ├── G-28-Spouse.pdf
│   ├── I-539-Spouse.pdf
│   ├── G-28-Child-1.pdf
│   ├── I-539A-Child-1.pdf
│   ├── G-28-Child-2.pdf
│   ├── I-539A-Child-2.pdf
│   ├── G-28-Child-3.pdf
│   ├── I-539A-Child-3.pdf
│   └── G-1650-ACH-Authorization-I-539-fee.pdf
│
├── TAB-K_NOID-Dependents/
│   ├── Notice-of-Intent-to-Depart-Spouse.pdf
│   ├── Notice-of-Intent-to-Depart-Child-1.pdf
│   ├── Notice-of-Intent-to-Depart-Child-2.pdf
│   └── Notice-of-Intent-to-Depart-Child-3.pdf
│
└── TAB-L_Dependent-Biographic-Info/
    ├── L-1_Spouse-<ASCII-Name>/
    │   ├── 01_Passport-Bio-Page.pdf
    │   ├── 02_US-Visa-and-I-94.pdf
    │   ├── 03_Marriage-Certificate-with-Translation.pdf
    │   └── 04_Vital-Records-Extract-with-Translation.pdf
    ├── L-2_Child-1_<ASCII-Name>/
    │   ├── 01_Passport-Bio-Page.pdf
    │   ├── 02_US-Visa-and-I-94.pdf
    │   └── 03_Vital-Records-Extract-with-Translation.pdf
    ├── L-3_Child-2_<ASCII-Name>/
    │   └── … (same structure)
    └── L-4_Child-3_<ASCII-Name>/
        └── … (same structure)
```

---

## Internal working folders (NOT filed — alongside Tab structure)

```
<CaseID>_..._E2/
│
├── _00-Intake/
│   ├── engagement-letter-signed.pdf
│   ├── conflict-check.pdf
│   ├── client-questionnaire.pdf
│   └── intake-call-notes.md
│
├── _Working-Drafts/
│   ├── cover-letter-V1-draft.docx
│   ├── cover-letter-V2-attorney-edit.docx
│   └── cover-letter-V3-final.docx
│
├── _Exhibit-Index/
│   ├── exhibit-index-MASTER.md         ← live document, see template C
│   └── exhibit-index-FINAL.pdf         ← printed, filed
│
├── _Correspondence/
│   ├── client-emails/
│   ├── USCIS-correspondence/           ← RFE / NOID / approval
│   └── consular-correspondence/
│
├── _Filing-Receipts/
│   ├── I-797-receipt-notice.pdf
│   └── case-status-screenshots/
│
├── _RFE-NOID/                          ← created if RFE issued
│   └── …
│
└── _99-Outcome/
    ├── approval-notice.pdf
    ├── lessons-learned.md
    └── retention-schedule.txt
```

> Underscore prefix = NOT filed with USCIS. Keeps internal vs. filed
> material visually separated in the case folder.

---

## Tab → Element cheatsheet

| Tab | Title | E-2 Element |
|-----|-------|-------------|
| A | Forms | Procedural |
| B | Cover Letter | Argument (all elements) |
| C | Qualification Under a Treaty of Commerce and Navigation | E1 — Nationality |
| D | Ownership Structure & Corporate History | E1 (50%+) + corporate setup |
| E | Investment: Source, Transfer, At-Risk Commitment | E2 — SOF + at-risk |
| F | Substantiality of the Investment | E2 — Proportionality |
| G | Marginality & Ongoing Commercial Activity | E3 + E4 |
| H | Role of Beneficiary: Develop & Direct | E5 |
| I | Notice of Intent to Depart (Principal) | NIV intent |
| J | Forms for Dependents/Derivatives | I-539 |
| K | Notice of Intent to Depart (Dependents) | NIV intent |
| L | Biographic/Immigration Info for Dependents | I-539 evidence |

---

## File-naming rules

| Rule | Why |
|---|---|
| **ASCII filenames** (Caglar, not Çağlar) | Cross-platform safe + matches filing |
| **Sentence case + dashes** (no spaces) | URL-safe, tab-completion-friendly |
| **`<NN>_<doc>` prefix per tab** | Sort order matches exhibit number |
| **Original date in filename** when material (e.g., `Title-Deed-2013-01-25.pdf`) | Disambiguation, audit trail |
| **`-FINAL` suffix on filed copies** | Clear which version went out |
| **`_underscore-prefix` for non-filed folders** | Visual separation from filing tabs |

---

## New vs. Renewal — what differs

| Item | New E-2 | Renewal |
|------|---------|---------|
| Tab C | No prior E-2 visa | Include prior E-2 visa + payroll records of prior E-2 employment |
| Tab D | Initial corporate setup is the focus | Include prior + current corporate history |
| Tab E | Source + transfer + initial at-risk | Plus continued at-risk commitment |
| Tab G | Often relies on 5-year projections (marginality on future capacity) | Often includes actual operating history (P&L, tax returns) |
| Tab H | Develop & direct is prospective | Includes prior E-2 employment history demonstrating develop & direct |

---

Last updated: 2026-04-27
Calibrated against: Kacar-Salih E-2 Renewal Filing (filed 2026-01-07)
