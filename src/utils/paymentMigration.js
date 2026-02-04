/**
 * Payment Migration Utility
 * 
 * This utility helps migrate paid invoices that don't have corresponding payment records.
 * Specifically designed to handle 2025 invoices that were marked as paid but never had
 * payment records created.
 */

import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import moment from "moment";

/**
 * Find all paid invoices that don't have payment records
 * @param {number} year - Year to search for (e.g., 2025)
 * @returns {Promise<Array>} - Array of invoices missing payment records
 */
export async function findInvoicesMissingPayments(year = 2025) {
  try {
    console.log(`🔍 Searching for paid invoices in ${year} without payment records...`);
    
    // Load all invoices for the year
    const invoicesSnap = await getDocs(collection(db, "invoices"));
    const invoices = invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Filter to paid invoices in the specified year
    const paidInvoices = invoices.filter((inv) => {
      if (inv.status !== "Paid") return false;
      
      // Check invoice date or payment date
      const dateToCheck = inv.paymentDate || inv.invoiceDate || inv.createdAt;
      if (!dateToCheck) return false;
      
      let invoiceYear;
      if (dateToCheck.toDate) {
        // Firestore timestamp
        invoiceYear = moment(dateToCheck.toDate()).year();
      } else if (typeof dateToCheck === "string") {
        // ISO string
        invoiceYear = moment(dateToCheck).year();
      } else {
        return false;
      }
      
      return invoiceYear === year;
    });
    
    console.log(`✅ Found ${paidInvoices.length} paid invoices in ${year}`);
    
    // Load all payment records
    const paymentsSnap = await getDocs(collection(db, "payments"));
    const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    console.log(`✅ Found ${payments.length} total payment records`);
    
    // Find invoices without corresponding payment records
    const missingPayments = [];
    
    for (const invoice of paidInvoices) {
      // Check if payment record exists for this invoice
      const hasPayment = payments.some((payment) => {
        return payment.invoiceId === invoice.id || 
               payment.reference?.includes(invoice.invoiceNumber?.toString());
      });
      
      if (!hasPayment) {
        missingPayments.push(invoice);
      }
    }
    
    console.log(`❌ Found ${missingPayments.length} invoices without payment records`);
    
    return missingPayments;
  } catch (error) {
    console.error("Error finding invoices missing payments:", error);
    throw error;
  }
}

/**
 * Create payment records for invoices that don't have them
 * @param {Array} invoices - Array of invoice objects
 * @param {boolean} dryRun - If true, only log what would be done without creating records
 * @returns {Promise<Object>} - Summary of migration results
 */
export async function createMissingPaymentRecords(invoices, dryRun = false) {
  try {
    console.log(`🔧 ${dryRun ? "DRY RUN - " : ""}Creating payment records for ${invoices.length} invoices...`);
    
    const results = {
      total: invoices.length,
      successful: 0,
      failed: 0,
      errors: [],
      createdPayments: [],
    };
    
    for (const invoice of invoices) {
      try {
        // Determine payment date
        let paymentDate = invoice.paymentDate;
        if (!paymentDate) {
          // Fallback to invoice date or createdAt
          paymentDate = invoice.invoiceDate || 
                       (invoice.createdAt?.toDate ? moment(invoice.createdAt.toDate()).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"));
        }
        
        // Create payment record
        const paymentData = {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || "N/A",
          clientName: invoice.clientName || invoice.customerName || "Unknown",
          amount: parseFloat(invoice.total || invoice.amount || 0),
          paymentMethod: invoice.paymentMethod || "Unknown",
          paymentDate: paymentDate,
          reference: `Migration - Invoice #${invoice.invoiceNumber || invoice.id.slice(-8)}`,
          notes: `Migrated payment record for paid invoice from ${moment(paymentDate).year()}`,
          receiptGenerated: false,
          createdAt: new Date().toISOString(),
          migratedAt: new Date().toISOString(),
          migratedFrom: "paymentMigration.js",
        };
        
        if (dryRun) {
          console.log(`  ✓ Would create payment for Invoice #${invoice.invoiceNumber}: $${paymentData.amount}`);
          results.successful++;
          results.createdPayments.push(paymentData);
        } else {
          const paymentRef = await addDoc(collection(db, "payments"), paymentData);
          console.log(`  ✅ Created payment ${paymentRef.id} for Invoice #${invoice.invoiceNumber}`);
          results.successful++;
          results.createdPayments.push({ id: paymentRef.id, ...paymentData });
        }
      } catch (error) {
        console.error(`  ❌ Failed to create payment for invoice ${invoice.id}:`, error);
        results.failed++;
        results.errors.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          error: error.message,
        });
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Successful: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    
    return results;
  } catch (error) {
    console.error("Error creating missing payment records:", error);
    throw error;
  }
}

/**
 * Main migration function - finds and creates missing payment records
 * @param {number} year - Year to migrate (e.g., 2025)
 * @param {boolean} dryRun - If true, only log what would be done
 * @returns {Promise<Object>} - Migration results
 */
export async function migratePayments(year = 2025, dryRun = false) {
  try {
    console.log(`\n🚀 Starting payment migration for ${year}...`);
    console.log(`   Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE (will create records)"}\n`);
    
    // Step 1: Find invoices missing payments
    const missingPayments = await findInvoicesMissingPayments(year);
    
    if (missingPayments.length === 0) {
      console.log(`\n✅ No missing payment records found for ${year}!`);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
        createdPayments: [],
      };
    }
    
    console.log(`\n📋 Invoices missing payment records:`);
    missingPayments.forEach((inv, idx) => {
      console.log(`   ${idx + 1}. Invoice #${inv.invoiceNumber || inv.id.slice(-8)} - ${inv.clientName} - $${inv.total || inv.amount || 0}`);
    });
    
    // Step 2: Create payment records
    console.log("");
    const results = await createMissingPaymentRecords(missingPayments, dryRun);
    
    console.log(`\n${dryRun ? "✅ DRY RUN COMPLETE" : "✅ MIGRATION COMPLETE"}`);
    
    return results;
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}
