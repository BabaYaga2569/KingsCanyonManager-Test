import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, LinearProgress, Chip } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

/**
 * ComprehensivePaymentSync - Creates payment records for ALL "Paid" invoices
 * 
 * This is the ONE SOURCE OF TRUTH fix!
 * - Finds all invoices marked as "Paid"
 * - Checks if they have payment records
 * - Creates missing payment records with correct client names
 * - Links everything together properly
 */

function ComprehensivePaymentSync() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);

  const runSync = async () => {
    setRunning(true);
    setProgress('Starting comprehensive payment sync...');
    setError(null);
    setResults(null);
    setDetails([]);

    try {
      // Get all invoices and payments
      setProgress('Loading invoices and payments...');
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`📊 Found ${invoices.length} invoices and ${payments.length} payments`);
      
      // Find all PAID invoices
      const paidInvoices = invoices.filter(inv => 
        inv.status && inv.status.toLowerCase() === 'paid'
      );
      
      console.log(`💰 Found ${paidInvoices.length} invoices marked as PAID`);
      setProgress(`Found ${paidInvoices.length} paid invoices, checking for payment records...`);
      
      let created = 0;
      let skipped = 0;
      let errors = 0;
      const detailsLog = [];
      
      for (let i = 0; i < paidInvoices.length; i++) {
        const invoice = paidInvoices[i];
        setProgress(`Processing ${i + 1} of ${paidInvoices.length}... (${invoice.clientName} - $${invoice.total || invoice.amount || 0})`);
        
        // Check if payment record already exists for this invoice
        const existingPayment = payments.find(p => p.invoiceId === invoice.id);
        
        if (existingPayment) {
          console.log(`  ⏭️  Payment record already exists for invoice ${invoice.id}`);
          detailsLog.push({
            clientName: invoice.clientName,
            amount: invoice.total || invoice.amount || 0,
            invoiceDate: invoice.invoiceDate || invoice.date,
            status: 'exists',
            paymentId: existingPayment.id
          });
          skipped++;
          continue;
        }
        
        // Create payment record
        try {
          const paymentData = {
            invoiceId: invoice.id,
            clientName: invoice.clientName || 'Unknown Client',
            amount: invoice.total || invoice.amount || 0,
            paymentMethod: 'other', // We don't know the method for old invoices
            paymentDate: invoice.invoiceDate || invoice.date || new Date().toISOString().split('T')[0],
            reference: 'Backfilled from paid invoice',
            notes: `Invoice: ${invoice.description || 'No description'} | Auto-created during payment sync`,
            receiptGenerated: false,
            createdAt: new Date().toISOString(),
          };
          
          const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
          
          console.log(`  ✅ Created payment record for ${invoice.clientName} - $${paymentData.amount}`);
          detailsLog.push({
            clientName: invoice.clientName,
            amount: paymentData.amount,
            invoiceDate: invoice.invoiceDate || invoice.date,
            status: 'created',
            paymentId: paymentRef.id
          });
          created++;
        } catch (err) {
          console.log(`  ❌ Error creating payment: ${err.message}`);
          detailsLog.push({
            clientName: invoice.clientName,
            amount: invoice.total || invoice.amount || 0,
            invoiceDate: invoice.invoiceDate || invoice.date,
            status: 'error',
            error: err.message
          });
          errors++;
        }
      }
      
      setProgress('Sync complete!');
      setResults({
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        created,
        skipped,
        errors
      });
      setDetails(detailsLog);
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 COMPREHENSIVE PAYMENT SYNC SUMMARY:');
      console.log('='.repeat(60));
      console.log(`Total invoices: ${invoices.length}`);
      console.log(`Paid invoices: ${paidInvoices.length}`);
      console.log(`✅ Payment records created: ${created}`);
      console.log(`⏭️  Already had payment records: ${skipped}`);
      console.log(`❌ Errors: ${errors}`);
      console.log('='.repeat(60));
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SyncIcon sx={{ mr: 1, fontSize: 30 }} />
        <Typography variant="h5" fontWeight="bold">
          🎯 Comprehensive Payment Sync - ONE SOURCE OF TRUTH
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>This will create payment records for ALL "Paid" invoices!</strong>
        <br />
        • Finds all invoices marked as "Paid"
        <br />
        • Checks if they have payment records
        <br />
        • Creates missing payment records with correct client names from invoices
        <br />
        • Links everything together properly
        <br /><br />
        <strong>This is the ONE SOURCE OF TRUTH fix!</strong> After this, your Payments Dashboard will show ALL your actual revenue.
        <br /><br />
        <strong>This is a ONE-TIME operation.</strong> After running, you can remove this component.
      </Alert>

      {!running && !results && (
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={<SyncIcon />}
          onClick={runSync}
        >
          Sync All Paid Invoices to Payments
        </Button>
      )}

      {running && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {results && (
        <>
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              ✅ Payment Sync Complete!
            </Typography>
            <Typography variant="body2">
              <strong>Total Invoices:</strong> {results.totalInvoices}<br />
              <strong>Paid Invoices:</strong> {results.paidInvoices}<br />
              <strong>✅ Payment Records Created:</strong> {results.created}<br />
              <strong>⏭️ Already Had Payment Records:</strong> {results.skipped}<br />
              <strong>❌ Errors:</strong> {results.errors}
            </Typography>
            <Typography variant="body2" sx={{ mt: 2, fontWeight: 'bold' }}>
              {results.created > 0 
                ? `🎉 Created ${results.created} payment records! Your Payments Dashboard now shows ALL your revenue!` 
                : '✅ All paid invoices already have payment records!'}
            </Typography>
          </Alert>

          {details.length > 0 && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'background.default', maxHeight: 400, overflowY: 'auto' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Details ({details.length} invoices processed):
              </Typography>
              {details.map((detail, idx) => (
                <Box key={idx} sx={{ mb: 1, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                  {detail.status === 'created' && (
                    <>
                      <Chip label="NEW" color="success" size="small" />
                      <Typography variant="body2">
                        {detail.clientName} - <strong>${detail.amount}</strong> ({detail.invoiceDate || 'No date'})
                      </Typography>
                    </>
                  )}
                  {detail.status === 'exists' && (
                    <>
                      <Chip label="EXISTS" color="default" size="small" />
                      <Typography variant="body2" color="text.secondary">
                        {detail.clientName} - ${detail.amount}
                      </Typography>
                    </>
                  )}
                  {detail.status === 'error' && (
                    <>
                      <Chip label="ERROR" color="error" size="small" />
                      <Typography variant="body2" color="error.main">
                        {detail.clientName} - ${detail.amount}: {detail.error}
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
            </Paper>
          )}

          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Success! You can now remove this component from your code and check your Payments Dashboard!
          </Typography>
        </>
      )}
    </Paper>
  );
}

export default ComprehensivePaymentSync;