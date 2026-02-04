# Payment Migration Guide

## Overview

This guide explains how to use the payment migration utility to create missing payment records for invoices that were marked as "Paid" but never had payment records created.

## Problem

Some invoices (especially from 2025) were marked as "Paid" manually, but the payment records in the `payments` collection were never created. This causes:
- Incorrect payment reporting
- Missing data in Payments Dashboard
- Inaccurate tax records

## Solution

The `paymentMigration.js` utility and `PaymentMigrationTool.jsx` component allow you to:
1. Scan for paid invoices without payment records
2. Preview what would be created (dry run)
3. Create the missing payment records

## Usage

### Option 1: Using the UI Component (Recommended)

1. **Add the route to your App.js:**
   ```javascript
   import PaymentMigrationTool from './PaymentMigrationTool';
   
   // In your routes:
   <Route path="/payment-migration" element={<PaymentMigrationTool />} />
   ```

2. **Navigate to `/payment-migration` in your browser**

3. **Follow the steps in the UI:**
   - Click "Scan 2025" to find missing payment records
   - Review the list of invoices
   - Click "Dry Run (Preview)" to see what would be created
   - If everything looks correct, click "Run Migration"

### Option 2: Using JavaScript Console

You can also run the migration directly from the browser console:

```javascript
// Import the migration utility
import { migratePayments } from './utils/paymentMigration';

// Dry run (preview only, no changes)
await migratePayments(2025, true);

// Actual migration (creates payment records)
await migratePayments(2025, false);
```

### Option 3: Using Node.js Script

Create a migration script:

```javascript
// scripts/migrate-payments.js
const { migratePayments } = require('../src/utils/paymentMigration');

async function run() {
  try {
    // Always do dry run first
    console.log('Running dry run...');
    await migratePayments(2025, true);
    
    // Uncomment below to run actual migration
    // console.log('\nRunning actual migration...');
    // await migratePayments(2025, false);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
```

## Safety Features

### Dry Run Mode
Always test with dry run first:
```javascript
await migratePayments(2025, true); // No database changes
```

### Detailed Logging
The utility logs every action:
- Which invoices are found
- What payment records would be created
- Success/failure for each record

### Error Handling
- Continues processing even if one record fails
- Returns detailed error information
- Doesn't corrupt existing data

## What Gets Created

For each paid invoice without a payment record, the utility creates:

```javascript
{
  invoiceId: "abc123",
  invoiceNumber: "INV-2025-001",
  clientName: "John Doe",
  amount: 500.00,
  paymentMethod: "Unknown", // Will use invoice's payment method if available
  paymentDate: "2025-01-15",
  reference: "Migration - Invoice #INV-2025-001",
  notes: "Migrated payment record for paid invoice from 2025",
  receiptGenerated: false,
  createdAt: "2026-02-04T...",
  migratedAt: "2026-02-04T...",
  migratedFrom: "paymentMigration.js"
}
```

## Verification

After running the migration, verify:

1. **Check Payments Dashboard:**
   - Should show the new payment records
   - Totals should match paid invoices

2. **Check Console Logs:**
   ```
   ✅ Migration complete!
   Total: 8
   Successful: 8
   Failed: 0
   ```

3. **Verify in Firebase Console:**
   - Open Firebase Console
   - Navigate to Firestore
   - Check `payments` collection
   - Look for records with `migratedFrom: "paymentMigration.js"`

## Troubleshooting

### "No missing payment records found"
This is good! It means all paid invoices have payment records.

### "Migration failed: Permission denied"
Check your Firebase security rules. The user running the migration needs write access to the `payments` collection.

### Some invoices failed to migrate
Check the error details in the results. Common issues:
- Missing required fields (clientName, amount, etc.)
- Invalid date formats
- Network issues

### Need to undo migration?
If you need to remove migrated records:
```javascript
// In Firebase Console or code:
const paymentsToDelete = await getDocs(
  query(
    collection(db, "payments"),
    where("migratedFrom", "==", "paymentMigration.js")
  )
);

// Review before deleting!
console.log(`Found ${paymentsToDelete.size} migrated payments`);
```

## Best Practices

1. **Always backup production data first**
2. **Test in TEST environment before PRODUCTION**
3. **Run dry run first**
4. **Verify results after migration**
5. **Document when you ran the migration**
6. **Only run once per year** (duplicate prevention built-in)

## Future Invoice Payments

The `InvoiceEditor.jsx` component now automatically creates payment records when invoices are marked as "Paid", so this migration should only need to be run once for historical data.

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your Firebase connection and permissions
3. Review the source code in `src/utils/paymentMigration.js`
4. Check that invoice data has required fields (clientName, amount, date)
