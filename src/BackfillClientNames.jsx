import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, LinearProgress } from '@mui/material';
import FixIcon from '@mui/icons-material/Build';

/**
 * BackfillClientNames v2 - IMPROVED VERSION
 * 
 * This version can find client names even without invoiceId by:
 * 1. First trying to use invoiceId (if it exists)
 * 2. Then searching for invoices by matching amount and date
 * 3. Manual review option for any that still can't be matched
 */

function BackfillClientNames() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);

  const runBackfill = async () => {
    setRunning(true);
    setProgress('Starting backfill...');
    setError(null);
    setResults(null);
    setDetails([]);

    try {
      // Get all payments and invoices
      setProgress('Loading payments and invoices...');
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`📊 Found ${payments.length} payments and ${invoices.length} invoices`);
      
      // Find payments without clientName
      const missingClientName = payments.filter(p => !p.clientName || p.clientName.trim() === '');
      
      console.log(`⚠️  Found ${missingClientName.length} payments missing clientName`);
      setProgress(`Found ${missingClientName.length} payments missing client names...`);
      
      let fixed = 0;
      let skipped = 0;
      let errors = 0;
      const detailsLog = [];
      
      for (let i = 0; i < missingClientName.length; i++) {
        const payment = missingClientName[i];
        setProgress(`Processing ${i + 1} of ${missingClientName.length}... ($${payment.amount})`);
        
        let clientName = null;
        let method = '';
        
        // Method 1: Try using invoiceId
        if (payment.invoiceId) {
          const invoice = invoices.find(inv => inv.id === payment.invoiceId);
          if (invoice && invoice.clientName) {
            clientName = invoice.clientName;
            method = 'by invoiceId';
          }
        }
        
        // Method 2: Search by amount and date
        if (!clientName && payment.amount && payment.paymentDate) {
          const paymentAmount = parseFloat(payment.amount);
          const paymentDateStr = payment.paymentDate;
          
          // Find invoices with matching amount
          const matchingInvoices = invoices.filter(inv => {
            const invAmount = parseFloat(inv.total || inv.amount || 0);
            const amountMatch = Math.abs(invAmount - paymentAmount) < 0.01;
            
            // Check if dates are close (within 7 days)
            let dateMatch = false;
            if (inv.invoiceDate || inv.date) {
              const invDateStr = inv.invoiceDate || inv.date;
              const invDate = invDateStr.toDate ? invDateStr.toDate() : new Date(invDateStr);
              const payDate = paymentDateStr.toDate ? paymentDateStr.toDate() : new Date(paymentDateStr);
              const daysDiff = Math.abs((invDate - payDate) / (1000 * 60 * 60 * 24));
              dateMatch = daysDiff <= 7;
            }
            
            return amountMatch && dateMatch && inv.clientName;
          });
          
          if (matchingInvoices.length === 1) {
            clientName = matchingInvoices[0].clientName;
            method = 'by amount/date match';
          } else if (matchingInvoices.length > 1) {
            // Multiple matches - take the closest date
            matchingInvoices.sort((a, b) => {
              const aDate = (a.invoiceDate || a.date).toDate ? (a.invoiceDate || a.date).toDate() : new Date(a.invoiceDate || a.date);
              const bDate = (b.invoiceDate || b.date).toDate ? (b.invoiceDate || b.date).toDate() : new Date(b.invoiceDate || b.date);
              const payDate = paymentDateStr.toDate ? paymentDateStr.toDate() : new Date(paymentDateStr);
              return Math.abs(aDate - payDate) - Math.abs(bDate - payDate);
            });
            clientName = matchingInvoices[0].clientName;
            method = 'by closest date match';
          }
        }
        
        // Update if we found a client name
        if (clientName) {
          try {
            await updateDoc(doc(db, 'payments', payment.id), {
              clientName: clientName
            });
            
            console.log(`  ✅ Fixed! Set clientName to: ${clientName} (${method})`);
            detailsLog.push({
              id: payment.id,
              amount: payment.amount,
              date: payment.paymentDate,
              clientName: clientName,
              method: method,
              status: 'fixed'
            });
            fixed++;
          } catch (err) {
            console.log(`  ❌ Error updating: ${err.message}`);
            detailsLog.push({
              id: payment.id,
              amount: payment.amount,
              date: payment.paymentDate,
              error: err.message,
              status: 'error'
            });
            errors++;
          }
        } else {
          console.log(`  ⚠️  Could not find matching invoice for $${payment.amount} on ${payment.paymentDate}`);
          detailsLog.push({
            id: payment.id,
            amount: payment.amount,
            date: payment.paymentDate,
            method: payment.paymentMethod,
            status: 'skipped'
          });
          skipped++;
        }
      }
      
      setProgress('Backfill complete!');
      setResults({
        total: payments.length,
        missingClientName: missingClientName.length,
        fixed,
        skipped,
        errors
      });
      setDetails(detailsLog);
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 BACKFILL SUMMARY:');
      console.log('='.repeat(60));
      console.log(`Total payments: ${payments.length}`);
      console.log(`Missing clientName: ${missingClientName.length}`);
      console.log(`✅ Fixed: ${fixed}`);
      console.log(`⚠️  Skipped: ${skipped}`);
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
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'warning.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <FixIcon sx={{ mr: 1, fontSize: 30 }} />
        <Typography variant="h5" fontWeight="bold">
          Backfill Utility v2 - Fix Missing Client Names (IMPROVED)
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>This version is smarter!</strong> It will try to find client names by:
        <br />• First checking invoiceId (if linked)
        <br />• Then matching by amount and date (within 7 days)
        <br />• Taking the closest match if multiple found
        <br /><br />
        <strong>This is a ONE-TIME operation.</strong> After running, you can remove this component.
      </Alert>

      {!running && !results && (
        <Button
          variant="contained"
          color="warning"
          size="large"
          startIcon={<FixIcon />}
          onClick={runBackfill}
        >
          Fix Missing Client Names (Smart Match)
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
          <Alert severity={results.fixed > 0 ? "success" : "warning"} sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              {results.fixed > 0 ? '✅ Backfill Complete!' : '⚠️ Backfill Complete (No Fixes)'}
            </Typography>
            <Typography variant="body2">
              <strong>Total Payments:</strong> {results.total}<br />
              <strong>Missing Client Names:</strong> {results.missingClientName}<br />
              <strong>✅ Fixed:</strong> {results.fixed}<br />
              <strong>⚠️ Skipped:</strong> {results.skipped}<br />
              <strong>❌ Errors:</strong> {results.errors}
            </Typography>
          </Alert>

          {details.length > 0 && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Details:
              </Typography>
              {details.map((detail, idx) => (
                <Box key={idx} sx={{ mb: 1, fontSize: '0.85rem' }}>
                  {detail.status === 'fixed' && (
                    <Typography variant="body2" color="success.main">
                      ✅ ${detail.amount} → {detail.clientName} ({detail.method})
                    </Typography>
                  )}
                  {detail.status === 'skipped' && (
                    <Typography variant="body2" color="warning.main">
                      ⚠️ ${detail.amount} on {detail.date} - No match found ({detail.method})
                    </Typography>
                  )}
                  {detail.status === 'error' && (
                    <Typography variant="body2" color="error.main">
                      ❌ ${detail.amount} - Error: {detail.error}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          )}

          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            {results.fixed > 0 
              ? 'Success! You can now remove this component from your code.' 
              : 'No automatic matches found. You may need to manually add client names to these payments.'}
          </Typography>
        </>
      )}
    </Paper>
  );
}

export default BackfillClientNames;