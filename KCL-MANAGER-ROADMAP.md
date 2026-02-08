# 🚀 KCL MANAGER - COMPLETE ROADMAP

> Last Updated: 2026-02-08
> Environment: Test (kcl-manager-test) → Firebase "KCL-Manager-TEST"
> Production: kcl-manager → Firebase "KCL-Manager" (185 records, 87 critical issues)
> GitHub: https://github.com/BabaYaga2569/KingsCanyonManager

---

## ✅ PHASE 1: COMPLETED

- [x] Created test environment (kcl-manager-test)
- [x] Built Migration Dashboard (audits data for orphaned records)
- [x] Ran audit on production: Found 87 critical issues (orphaned schedules, invoices, payments)
- [x] Set up Git with safety backups (production-safe-backup branch)
- [x] Committed everything to GitHub

---

## ✅ PHASE 2A: FORM VALIDATION (COMPLETED)

- [x] CustomerEditor.jsx - Made address field REQUIRED (validation + UI)
- [x] CustomerProfile.jsx - Made address field REQUIRED (validation + UI)
- [x] Both save paths for customers now enforce: Name, Phone, Address

---

## 🚨 CRITICAL DESIGN DECISION

**REMOVING standalone "Schedule Job" functionality.**

Schedules can ONLY be created through the automated workflow paths below.
This prevents the 87 orphaned schedule issues found in production.

### The Problem (Current Production):
- ❌ Users can schedule jobs WITHOUT selecting a customer
- ❌ Creates orphaned schedules (87 critical issues!)
- ❌ No link between schedule → invoice → contract → customer
- ❌ Can't track who the job is for

### The Solution:
- ✅ Schedule ONLY created through workflow
- ✅ Must have customer FIRST
- ✅ Must have contract/invoice
- ✅ Everything linked from the start
- ✅ No orphans possible!

---

## 🔄 THE 3 WORKFLOW PATHS

### Flow 1: Full Bid Path (Standard Jobs)
```
Create Bid → Creates Customer → Customer Signs Bid → Creates Contract → Customer Signs Contract → Creates Job → Job Gets Scheduled
```

### Flow 2: Quick Weed Invoice (Simple/Small Jobs)
```
Quick Weed Invoice → Fill in all info (customer, dates, time, services) → Creates Invoice + Creates Job on Schedule/Calendar automatically
```

### Flow 3: Maintenance Path
```
Create Maintenance → Same path as Bid flow (Bid → Contract → Job → Schedule)
```

**Key Rule: You can NEVER create a schedule without going through one of these 3 paths.**

---

## 📋 PHASE 2B: REMOVE STANDALONE SCHEDULING

- [ ] Remove "Schedule Job" from main navigation
- [ ] Remove direct route access to /schedule-job
- [ ] Comment out (don't delete) ScheduleJob.jsx for reference
- [ ] "Add Job" buttons on Calendar → redirect to WorkflowWizard
- [ ] Schedule/Calendar views remain for VIEWING existing schedules
- [ ] Can still EDIT date/time/crew on existing schedules
- [ ] Can still COMPLETE/CANCEL existing schedules
- [ ] CANNOT create new schedule directly

---

## 📋 PHASE 2C: BUILD WORKFLOW WIZARD

**File: WorkflowWizard.jsx** - Multi-step form for standard job creation

### Step 1: Customer (REQUIRED)
- Select existing customer OR create new
- Required fields: Name, Address, Phone
- Auto-fills customer info for remaining steps

### Step 2: Create Bid/Quote
- Service description
- Line items with pricing
- Save as bid (status: "pending")
- Linked to customerId from Step 1

### Step 3: Approval → Contract
- Customer approves bid (manual or digital signature)
- Convert bid to contract
- Contract linked to customerId + bidId

### Step 4: Generate Invoice
- Auto-generate from contract details
- Already linked to customerId + contractId
- Can edit amounts/details if needed

### Step 5: Schedule Job
- Pick date/time
- Assign employees
- Assign equipment
- Auto-linked to: customerId, contractId, invoiceId, bidId
- CANNOT create schedule without completing Steps 1-4

### Result:
```
Customer ← Bid ← Contract ← Invoice ← Schedule
    ↑         ↑        ↑          ↑          ↑
    └─────────┴────────┴──────────┴──────────┘
              ALL LINKED BY customerId
              NO ORPHANS POSSIBLE
```

---

## 📋 PHASE 2D: BUILD QUICK JOB SHORTCUT

**File: QuickJob.jsx** - One-page form for simple/small jobs

### Form Fields:
- Customer (select existing or create new) - REQUIRED
- Service description - REQUIRED
- Date/Time - REQUIRED
- Amount - REQUIRED

### Behind the Scenes (automatic):
- → Creates customer (if new)
- → Creates simple contract
- → Creates invoice
- → Creates schedule entry
- → All linked automatically by customerId

---

## 📋 PHASE 2E: UPDATE CALENDAR/SCHEDULE VIEWS

- [ ] Calendar shows existing schedules (no change)
- [ ] Can click to view schedule details
- [ ] Can edit date/time/crew on existing
- [ ] Can mark complete/cancelled
- [ ] "Add New Job" button → Opens WorkflowWizard
- [ ] "Quick Job" button → Opens QuickJob form
- [ ] NO direct schedule creation from calendar

---

## 📋 PHASE 3: DATA MIGRATION

- [ ] Run Migration Dashboard audit on production
- [ ] Fix 87 critical orphaned records
- [ ] Link orphaned schedules to customers where possible
- [ ] Archive unrecoverable orphaned records
- [ ] Re-run audit to confirm 0 critical issues

---

## 📋 PHASE 4: DEPLOY TO PRODUCTION

- [ ] All workflows tested in test environment
- [ ] Migration dashboard shows 0 critical issues in test
- [ ] Create production backup
- [ ] Deploy code changes to production
- [ ] Run data migration on production
- [ ] Verify 0 critical issues in production

---

## 📝 BUILD ORDER (Priority)

| Order | Task | Why |
|-------|------|-----|
| 1 | ✅ Customer validation (DONE) | Prevents bad customer data |
| 2 | Remove standalone Schedule Job | Stops new orphans immediately |
| 3 | Build WorkflowWizard.jsx | The proper job creation path |
| 4 | Build QuickJob.jsx | Simple jobs shortcut |
| 5 | Update Calendar views | Point "Add Job" to wizard |
| 6 | Validate remaining forms (Invoice, Contract) | Belt and suspenders |
| 7 | Data migration on production | Fix the 87 existing issues |
| 8 | Deploy everything | Go live |

---

## 🔧 TECHNICAL NOTES

### Firebase Collections & Required Links:
```
customers    → standalone (name, address, phone required)
bids         → MUST have customerId
contracts    → MUST have customerId + bidId
invoices     → MUST have customerId + contractId (or standalone for QuickJob)
schedules    → MUST have customerId + contractId + invoiceId
jobs         → MUST have customerId + scheduleId
```

### Files Modified So Far:
- `src/CustomerEditor.jsx` - Added address validation
- `src/CustomerProfile.jsx` - Added address validation

### Files To Create:
- `src/WorkflowWizard.jsx` - Multi-step job creation
- `src/QuickJob.jsx` - Simple job creation

### Files To Modify:
- `src/App.jsx` - Remove /schedule-job route, add /workflow and /quick-job routes
- Navigation component - Remove "Schedule Job", add "Create Job" / "Quick Job"
- Calendar component - Update "Add Job" button to open WorkflowWizard

### Files To Keep (Reference Only):
- `src/ScheduleJob.jsx` - Comment out, keep for reference code
