import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, LinearProgress, List, ListItem, ListItemText, Chip, Card, CardContent, Grid } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BuildIcon from '@mui/icons-material/Build';

/**
 * CorrectedBackfill - Creates payment records with CORRECT DATES
 * 
 * This version properly converts invoice dates to payment dates!
 * Bug fix: Properly handles Firestore timestamps
 */

function CorrectedBackfill() {
  const [phase, setPhase] = useState('ready');
  const [progress, setProgress] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const analyzeData = async () => {
    setPhase('analyzing');
    setProgress('Analyzing invoices and payments...');
    setError(null);
    setAnalysis(null);

    try {
      // Get all invoices and payments
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('='.repeat(70));
      console.log('🔍 CORRECTED BACKFILL ANALYSIS');
      console.log('='.repeat(70));
      
      // Find 2025 paid invoices without payment records
      const paidInvoices2025 = invoices.filter(inv => {
        if (!inv.status || inv.status.toLowerCase() !== 'paid') return false;
        
        const dateField = inv.invoiceDate || inv.date;
        if (!dateField) return false;
        
        try {
          const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
          return date.getFullYear() === 2025;
        } catch (err) {
          return false;
        }
      });
      
      console.log(`\n📊 Found ${paidInvoices2025.length} paid invoices from 2025`);
      
      // Find which ones need payment records
      const needsPayment = [];
      for (const invoice of paidInvoices2025) {
        const hasPayment = payments.find(p => p.invoiceId === invoice.id);
        if (!hasPayment) {
          // Get the proper date string
          const dateField = invoice.invoiceDate || invoice.date;
          let dateString;
          try {
            if (dateField.toDate) {
              dateString = dateField.toDate().toISOString().split('T')[0];
            } else {
              dateString = new Date(dateField).toISOString().split('T')[0];
            }
          } catch (err) {
            dateString = 'ERROR';
          }
          
          needsPayment.push({
            invoice: invoice,
            clientName: invoice.clientName,
            amount: parseFloat(invoice.total || invoice.amount || 0),
            dateString: dateString,
            description: invoice.description || 'No description'
          });
          
          console.log(`  ⚠️  ${invoice.clientName}: $${invoice.total || invoice.amount} (${dateString})`);
        }
      }
      
      console.log(`\n✅ ${paidInvoices2025.length - needsPayment.length} already have payment records`);
      console.log(`⚠️  ${needsPayment.length} need payment records created`);
      
      const totalAmount = needsPayment.reduce((sum, item) => sum + item.amount, 0);
      
      setAnalysis({
        total2025Paid: paidInvoices2025.length,
        alreadyHavePayments: paidInvoices2025.length - needsPayment.length,
        needsPayment: needsPayment,
        needsPaymentCount: needsPayment.length,
        totalAmount: totalAmount
      });
      setPhase('analyzed');
      setProgress('Analysis complete!');
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
      setPhase('ready');
    }
  };

  const createPayments = async () => {
    setPhase('creating');
    setProgress('Creating payment records with correct dates...');
    setResults(null);

    try {
      const toCreate = analysis.needsPayment;
      let created = 0;
      let errors = 0;
      const details = [];
      
      for (let i = 0; i < toCreate.length; i++) {
        const item = toCreate[i];
        setProgress(`Creating ${i + 1} of ${toCreate.length}... (${item.clientName} - $${item.amount.toFixed(2)} on ${item.dateString})`);
        
        try {
          const paymentData = {
            invoiceId: item.invoice.id,
            clientName: item.clientName,
            amount: item.amount,
            paymentMethod: 'other',
            paymentDate: item.dateString, // CORRECT DATE FROM INVOICE
            reference: 'Corrected sync - proper date',
            notes: `Invoice: ${item.description} | Created with corrected date handling`,
            receiptGenerated: false,
            createdAt: new Date().toISOString(),
          };
          
          await addDoc(collection(db, 'payments'), paymentData);
          
          console.log(`  ✅ Created: ${item.clientName} - $${item.amount.toFixed(2)} (${item.dateString})`);
          details.push({
            clientName: item.clientName,
            amount: item.amount,
            date: item.dateString,
            status: 'created'
          });
          created++;
        } catch (err) {
          console.log(`  ❌ Error: ${err.message}`);
          details.push({
            clientName: item.clientName,
            amount: item.amount,
            date: item.dateString,
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
      setProgress('All payments created with correct dates!');
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ CORRECTED BACKFILL COMPLETE');
      console.log('='.repeat(70));
      console.log(`Created: ${created} payment records`);
      console.log(`Errors: ${errors}`);
      console.log('='.repeat(70));
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
      setPhase('analyzed');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CheckCircleIcon sx={{ mr: 1, fontSize: 30, color: 'success.dark' }} />
        <Typography variant="h5" fontWeight="bold" color="success.dark">
          ✅ Corrected Backfill - Proper 2025 Dates
        </Typography>
      </Box>

      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          This version is FIXED and will use the CORRECT dates from your invoices!
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          ✅ Properly converts Firestore timestamps to date strings
          <br />
          ✅ Uses the ORIGINAL invoice dates from 2025
          <br />
          ✅ Links payment records to invoices correctly
        </Typography>
      </Alert>

      {/* Ready */}
      {phase === 'ready' && (
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={<BuildIcon />}
          onClick={analyzeData}
        >
          Step 1: Analyze 2025 Paid Invoices
        </Button>
      )}

      {/* Analyzing */}
      {phase === 'analyzing' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Show analysis */}
      {phase === 'analyzed' && analysis && (
        <>
          <Grid container spacing={2} sx={{ mt: 2, mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'info.light' }}>
                <CardContent>
                  <Typography variant="h6">Total 2025 Paid</Typography>
                  <Typography variant="h4">{analysis.total2025Paid}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'success.light' }}>
                <CardContent>
                  <Typography variant="h6">Already Have Payments</Typography>
                  <Typography variant="h4">{analysis.alreadyHavePayments}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'warning.light' }}>
                <CardContent>
                  <Typography variant="h6">Need Payments</Typography>
                  <Typography variant="h4">{analysis.needsPaymentCount}</Typography>
                  <Typography variant="body2">${analysis.totalAmount.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {analysis.needsPaymentCount > 0 && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  📋 Payment Records to Create:
                </Typography>
                <List dense>
                  {analysis.needsPayment.map((item, idx) => (
                    <ListItem key={idx} sx={{ py: 0 }}>
                      <ListItemText
                        primary={`${item.clientName} - $${item.amount.toFixed(2)}`}
                        secondary={`Date: ${item.dateString}`}
                      />
                      <Chip label="CREATE" color="success" size="small" />
                    </ListItem>
                  ))}
                </List>
              </Alert>

              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={createPayments}
              >
                Step 2: Create {analysis.needsPaymentCount} Payment Records (With Correct Dates!)
              </Button>
            </>
          )}

          {analysis.needsPaymentCount === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              ✅ Perfect! All 2025 paid invoices already have payment records!
            </Alert>
          )}
        </>
      )}

      {/* Creating */}
      {phase === 'creating' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Complete */}
      {phase === 'complete' && results && (
        <>
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              🎉 All Payment Records Created With Correct Dates!
            </Typography>
            <Typography variant="body2">
              <strong>✅ Created: {results.created} payment records</strong>
              <br />
              <strong>❌ Errors: {results.errors}</strong>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              🎯 Next Steps:
            </Typography>
            <Typography variant="body2">
              1. Go to Payments Dashboard
              <br />
              2. Set filter to "2025"
              <br />
              3. Hard refresh (Ctrl+Shift+R)
              <br />
              4. You should now see {results.created} payments with CORRECT 2025 dates!
              <br />
              5. Remove this component from Dashboard.jsx
              <br />
              6. Push to GitHub!
            </Typography>
          </Alert>

          {results.details.length > 0 && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default', maxHeight: 300, overflowY: 'auto' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Details:
              </Typography>
              {results.details.map((detail, idx) => (
                <Box key={idx} sx={{ mb: 0.5 }}>
                  {detail.status === 'created' && (
                    <Typography variant="body2" color="success.main">
                      ✅ {detail.clientName} - ${detail.amount.toFixed(2)} ({detail.date})
                    </Typography>
                  )}
                  {detail.status === 'error' && (
                    <Typography variant="body2" color="error.main">
                      ❌ {detail.clientName} - ${detail.amount.toFixed(2)}: {detail.error}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          )}
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}
    </Paper>
  );
}

export default CorrectedBackfill;