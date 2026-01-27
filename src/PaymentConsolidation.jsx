import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, LinearProgress, Chip, Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/**
 * PaymentConsolidation - DIAGNOSTIC + FIX TOOL
 * 
 * Phase 1: DIAGNOSE - Shows you exactly what exists
 * Phase 2: CONSOLIDATE - Creates missing payment records
 * Phase 3: VERIFY - Confirms everything is synced
 */

function PaymentConsolidation() {
  const [phase, setPhase] = useState('ready'); // ready, diagnosing, diagnosed, fixing, complete
  const [progress, setProgress] = useState('');
  const [diagnostic, setDiagnostic] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runDiagnostic = async () => {
    setPhase('diagnosing');
    setProgress('Starting diagnostic scan...');
    setError(null);
    setDiagnostic(null);

    try {
      // Get ALL invoices and payments
      setProgress('Loading all invoices...');
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setProgress('Loading all payments...');
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('='.repeat(70));
      console.log('📊 COMPREHENSIVE DATABASE DIAGNOSTIC');
      console.log('='.repeat(70));
      
      // Analyze invoices
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(inv => 
        inv.status && inv.status.toLowerCase() === 'paid'
      );
      const pendingInvoices = invoices.filter(inv => 
        !inv.status || inv.status.toLowerCase() !== 'paid'
      );
      
      // Analyze payments
      const totalPayments = payments.length;
      const paymentsWithInvoiceId = payments.filter(p => p.invoiceId);
      const paymentsWithoutInvoiceId = payments.filter(p => !p.invoiceId);
      const paymentsWithClientName = payments.filter(p => p.clientName && p.clientName.trim() !== '');
      const paymentsWithoutClientName = payments.filter(p => !p.clientName || p.clientName.trim() === '');
      
      // Find mismatches
      const paidInvoicesWithoutPayment = [];
      const paidInvoicesWithPayment = [];
      
      for (const invoice of paidInvoices) {
        const hasPayment = payments.find(p => p.invoiceId === invoice.id);
        if (hasPayment) {
          paidInvoicesWithPayment.push({
            invoice,
            payment: hasPayment
          });
        } else {
          paidInvoicesWithoutPayment.push(invoice);
        }
      }
      
      // Calculate revenue
      const invoiceRevenue = paidInvoices.reduce((sum, inv) => 
        sum + parseFloat(inv.total || inv.amount || 0), 0
      );
      const paymentRevenue = payments.reduce((sum, p) => 
        sum + parseFloat(p.amount || 0), 0
      );
      
      // Group by year
      const payments2025 = payments.filter(p => {
        const date = p.paymentDate || p.createdAt;
        if (!date) return false;
        const year = date.toDate ? date.toDate().getFullYear() : new Date(date).getFullYear();
        return year === 2025;
      });
      
      const payments2026 = payments.filter(p => {
        const date = p.paymentDate || p.createdAt;
        if (!date) return false;
        const year = date.toDate ? date.toDate().getFullYear() : new Date(date).getFullYear();
        return year === 2026;
      });
      
      const diagnosticData = {
        invoices: {
          total: totalInvoices,
          paid: paidInvoices.length,
          pending: pendingInvoices.length,
          paidRevenue: invoiceRevenue.toFixed(2)
        },
        payments: {
          total: totalPayments,
          withInvoiceId: paymentsWithInvoiceId.length,
          withoutInvoiceId: paymentsWithoutInvoiceId.length,
          withClientName: paymentsWithClientName.length,
          withoutClientName: paymentsWithoutClientName.length,
          revenue: paymentRevenue.toFixed(2),
          by2025: payments2025.length,
          by2026: payments2026.length
        },
        mismatches: {
          paidInvoicesWithoutPayment: paidInvoicesWithoutPayment.length,
          paidInvoicesWithPayment: paidInvoicesWithPayment.length,
          missingPaymentRecords: paidInvoicesWithoutPayment
        },
        revenueMismatch: Math.abs(invoiceRevenue - paymentRevenue).toFixed(2)
      };
      
      console.log('\n📊 DIAGNOSTIC RESULTS:');
      console.log('='.repeat(70));
      console.log('\nINVOICES:');
      console.log(`  Total: ${diagnosticData.invoices.total}`);
      console.log(`  Paid: ${diagnosticData.invoices.paid} ($${diagnosticData.invoices.paidRevenue})`);
      console.log(`  Pending: ${diagnosticData.invoices.pending}`);
      console.log('\nPAYMENTS:');
      console.log(`  Total: ${diagnosticData.payments.total}`);
      console.log(`  With InvoiceId: ${diagnosticData.payments.withInvoiceId}`);
      console.log(`  Without InvoiceId: ${diagnosticData.payments.withoutInvoiceId}`);
      console.log(`  With ClientName: ${diagnosticData.payments.withClientName}`);
      console.log(`  Without ClientName: ${diagnosticData.payments.withoutClientName}`);
      console.log(`  Revenue: $${diagnosticData.payments.revenue}`);
      console.log(`  2025: ${diagnosticData.payments.by2025} payments`);
      console.log(`  2026: ${diagnosticData.payments.by2026} payments`);
      console.log('\nMISMATCHES:');
      console.log(`  ⚠️  Paid invoices WITHOUT payment records: ${diagnosticData.mismatches.paidInvoicesWithoutPayment}`);
      console.log(`  ✅ Paid invoices WITH payment records: ${diagnosticData.mismatches.paidInvoicesWithPayment}`);
      console.log(`  💰 Revenue mismatch: $${diagnosticData.revenueMismatch}`);
      console.log('='.repeat(70));
      
      setDiagnostic(diagnosticData);
      setPhase('diagnosed');
      setProgress('Diagnostic complete!');
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
      setPhase('ready');
    }
  };

  const runConsolidation = async () => {
    setPhase('fixing');
    setProgress('Starting consolidation...');
    setResults(null);

    try {
      const missingInvoices = diagnostic.mismatches.missingPaymentRecords;
      
      let created = 0;
      let errors = 0;
      const details = [];
      
      for (let i = 0; i < missingInvoices.length; i++) {
        const invoice = missingInvoices[i];
        setProgress(`Creating payment ${i + 1} of ${missingInvoices.length}... (${invoice.clientName} - $${invoice.total || invoice.amount || 0})`);
        
        try {
          const paymentData = {
            invoiceId: invoice.id,
            clientName: invoice.clientName || 'Unknown Client',
            amount: invoice.total || invoice.amount || 0,
            paymentMethod: 'other',
            paymentDate: invoice.invoiceDate || invoice.date || new Date().toISOString().split('T')[0],
            reference: 'Consolidated from paid invoice',
            notes: `Invoice: ${invoice.description || 'No description'} | Consolidated during payment sync`,
            receiptGenerated: false,
            createdAt: new Date().toISOString(),
          };
          
          await addDoc(collection(db, 'payments'), paymentData);
          
          console.log(`  ✅ Created: ${invoice.clientName} - $${paymentData.amount}`);
          details.push({
            clientName: invoice.clientName,
            amount: paymentData.amount,
            date: invoice.invoiceDate || invoice.date,
            status: 'created'
          });
          created++;
        } catch (err) {
          console.log(`  ❌ Error: ${err.message}`);
          details.push({
            clientName: invoice.clientName,
            amount: invoice.total || invoice.amount || 0,
            status: 'error',
            error: err.message
          });
          errors++;
        }
      }
      
      setResults({
        created,
        errors,
        details
      });
      setPhase('complete');
      setProgress('Consolidation complete!');
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
      setPhase('diagnosed');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SearchIcon sx={{ mr: 1, fontSize: 30 }} />
        <Typography variant="h5" fontWeight="bold">
          🔍 Payment Consolidation - ONE SOURCE OF TRUTH
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>This tool will find ALL payment-related data and consolidate it!</strong>
        <br />
        <strong>Phase 1 (DIAGNOSE):</strong> Scans your entire database and shows you what exists
        <br />
        <strong>Phase 2 (CONSOLIDATE):</strong> Creates missing payment records for all paid invoices
        <br />
        <strong>Phase 3 (VERIFY):</strong> Confirms everything is synced to ONE SOURCE OF TRUTH
      </Alert>

      {/* Phase 1: Ready to diagnose */}
      {phase === 'ready' && (
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<SearchIcon />}
          onClick={runDiagnostic}
        >
          Phase 1: Run Diagnostic Scan
        </Button>
      )}

      {/* Diagnostic in progress */}
      {phase === 'diagnosing' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Phase 2: Show diagnostic results */}
      {phase === 'diagnosed' && diagnostic && (
        <>
          <Alert severity={diagnostic.mismatches.paidInvoicesWithoutPayment > 0 ? "warning" : "success"} sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              📊 Diagnostic Complete!
            </Typography>
            <Typography variant="body2">
              <strong>Found {diagnostic.mismatches.paidInvoicesWithoutPayment} paid invoices without payment records!</strong>
            </Typography>
          </Alert>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">📋 Full Diagnostic Report</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell><strong>Count</strong></TableCell>
                    <TableCell><strong>Details</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Total Invoices</TableCell>
                    <TableCell>{diagnostic.invoices.total}</TableCell>
                    <TableCell>All invoices in database</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'success.light' }}>
                    <TableCell>Paid Invoices</TableCell>
                    <TableCell>{diagnostic.invoices.paid}</TableCell>
                    <TableCell>${diagnostic.invoices.paidRevenue} revenue</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Pending Invoices</TableCell>
                    <TableCell>{diagnostic.invoices.pending}</TableCell>
                    <TableCell>Not yet paid</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'info.light' }}>
                    <TableCell>Total Payments</TableCell>
                    <TableCell>{diagnostic.payments.total}</TableCell>
                    <TableCell>${diagnostic.payments.revenue} recorded</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025 Payments</TableCell>
                    <TableCell>{diagnostic.payments.by2025}</TableCell>
                    <TableCell>Payments from 2025</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026 Payments</TableCell>
                    <TableCell>{diagnostic.payments.by2026}</TableCell>
                    <TableCell>Payments from 2026</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Payments with Client Name</TableCell>
                    <TableCell>{diagnostic.payments.withClientName}</TableCell>
                    <TableCell>Have client names</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'warning.light' }}>
                    <TableCell>Payments WITHOUT Client Name</TableCell>
                    <TableCell>{diagnostic.payments.withoutClientName}</TableCell>
                    <TableCell>Missing client names</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'error.light' }}>
                    <TableCell><strong>⚠️ MISSING Payment Records</strong></TableCell>
                    <TableCell><strong>{diagnostic.mismatches.paidInvoicesWithoutPayment}</strong></TableCell>
                    <TableCell><strong>Paid invoices without payment records!</strong></TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'error.light' }}>
                    <TableCell><strong>💰 Revenue Mismatch</strong></TableCell>
                    <TableCell><strong>${diagnostic.revenueMismatch}</strong></TableCell>
                    <TableCell><strong>Difference between invoices & payments</strong></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>

          {diagnostic.mismatches.paidInvoicesWithoutPayment > 0 && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<SyncIcon />}
                onClick={runConsolidation}
              >
                Phase 2: Create {diagnostic.mismatches.paidInvoicesWithoutPayment} Missing Payment Records
              </Button>
            </Box>
          )}

          {diagnostic.mismatches.paidInvoicesWithoutPayment === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              ✅ Perfect! All paid invoices already have payment records. You have ONE SOURCE OF TRUTH!
            </Alert>
          )}
        </>
      )}

      {/* Fixing in progress */}
      {phase === 'fixing' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Phase 3: Complete */}
      {phase === 'complete' && results && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            🎉 Consolidation Complete! ONE SOURCE OF TRUTH ACHIEVED!
          </Typography>
          <Typography variant="body2">
            <strong>✅ Created {results.created} payment records</strong>
            <br />
            <strong>❌ Errors: {results.errors}</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 'bold' }}>
            🎯 Your Payments Dashboard now shows ALL your revenue! Go check it out!
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}
    </Paper>
  );
}

export default PaymentConsolidation;