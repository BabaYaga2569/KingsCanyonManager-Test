import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { 
  Box, Button, Paper, Typography, Alert, LinearProgress, 
  Grid, Card, CardContent, Chip, Divider, List, ListItem, ListItemText
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import FixIcon from '@mui/icons-material/Build';

/**
 * SideBySideComparison - Shows EXACTLY what's missing
 * 
 * LEFT: Paid invoices from 2025
 * RIGHT: Payments from 2025
 * HIGHLIGHTS: What's missing
 */

function SideBySideComparison() {
  const [phase, setPhase] = useState('ready');
  const [progress, setProgress] = useState('');
  const [comparison, setComparison] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runComparison = async () => {
    setPhase('comparing');
    setProgress('Loading data...');
    setError(null);
    setComparison(null);

    try {
      // Get all invoices and payments
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('='.repeat(80));
      console.log('🔍 SIDE-BY-SIDE COMPARISON - 2025 DATA');
      console.log('='.repeat(80));
      
      // Filter 2025 PAID invoices
      const paidInvoices2025 = invoices.filter(inv => {
        if (!inv.status || inv.status.toLowerCase() !== 'paid') return false;
        
        const dateField = inv.invoiceDate || inv.date;
        if (!dateField) return false;
        
        const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
        return date.getFullYear() === 2025;
      }).map(inv => ({
        id: inv.id,
        clientName: inv.clientName,
        amount: parseFloat(inv.total || inv.amount || 0),
        date: inv.invoiceDate || inv.date,
        description: inv.description || 'No description'
      }));
      
      // Filter 2025 payments
      const payments2025 = payments.filter(p => {
        const dateField = p.paymentDate || p.createdAt;
        if (!dateField) return false;
        
        const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
        return date.getFullYear() === 2025;
      }).map(p => ({
        id: p.id,
        clientName: p.clientName,
        amount: parseFloat(p.amount || 0),
        date: p.paymentDate || p.createdAt,
        invoiceId: p.invoiceId,
        method: p.paymentMethod
      }));
      
      console.log(`\n📊 2025 PAID INVOICES: ${paidInvoices2025.length}`);
      paidInvoices2025.forEach(inv => {
        const dateStr = inv.date.toDate ? inv.date.toDate().toLocaleDateString() : new Date(inv.date).toLocaleDateString();
        console.log(`  ${inv.clientName}: $${inv.amount.toFixed(2)} (${dateStr})`);
      });
      
      console.log(`\n💰 2025 PAYMENTS: ${payments2025.length}`);
      payments2025.forEach(p => {
        const dateStr = p.date.toDate ? p.date.toDate().toLocaleDateString() : new Date(p.date).toLocaleDateString();
        console.log(`  ${p.clientName || 'NO NAME'}: $${p.amount.toFixed(2)} (${dateStr}) ${p.invoiceId ? '[Linked]' : '[No Link]'}`);
      });
      
      // Find missing payment records
      const missingPayments = [];
      for (const invoice of paidInvoices2025) {
        // Check if this invoice has a payment record
        const hasPayment = payments2025.find(p => p.invoiceId === invoice.id);
        if (!hasPayment) {
          missingPayments.push(invoice);
        }
      }
      
      console.log(`\n❌ MISSING PAYMENT RECORDS: ${missingPayments.length}`);
      missingPayments.forEach(inv => {
        const dateStr = inv.date.toDate ? inv.date.toDate().toLocaleDateString() : new Date(inv.date).toLocaleDateString();
        console.log(`  ${inv.clientName}: $${inv.amount.toFixed(2)} (${dateStr})`);
      });
      
      // Calculate totals
      const invoiceTotal = paidInvoices2025.reduce((sum, inv) => sum + inv.amount, 0);
      const paymentTotal = payments2025.reduce((sum, p) => sum + p.amount, 0);
      const missingTotal = missingPayments.reduce((sum, inv) => sum + inv.amount, 0);
      
      console.log(`\n💵 TOTALS:`);
      console.log(`  Paid Invoices 2025: $${invoiceTotal.toFixed(2)}`);
      console.log(`  Payments 2025: $${paymentTotal.toFixed(2)}`);
      console.log(`  Missing: $${missingTotal.toFixed(2)}`);
      console.log('='.repeat(80));
      
      setComparison({
        paidInvoices2025,
        payments2025,
        missingPayments,
        invoiceTotal,
        paymentTotal,
        missingTotal
      });
      setPhase('compared');
      setProgress('Comparison complete!');
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
      setPhase('ready');
    }
  };

  const createMissingPayments = async () => {
    setPhase('fixing');
    setProgress('Creating missing payment records...');
    setResults(null);

    try {
      const missing = comparison.missingPayments;
      let created = 0;
      let errors = 0;
      const details = [];
      
      for (let i = 0; i < missing.length; i++) {
        const invoice = missing[i];
        setProgress(`Creating payment ${i + 1} of ${missing.length}... (${invoice.clientName} - $${invoice.amount.toFixed(2)})`);
        
        try {
          // Convert date properly
          let paymentDate;
          if (invoice.date.toDate) {
            paymentDate = invoice.date.toDate().toISOString().split('T')[0];
          } else {
            paymentDate = new Date(invoice.date).toISOString().split('T')[0];
          }
          
          const paymentData = {
            invoiceId: invoice.id,
            clientName: invoice.clientName,
            amount: invoice.amount,
            paymentMethod: 'other',
            paymentDate: paymentDate,
            reference: 'Created from paid invoice - 2025 sync',
            notes: `Invoice: ${invoice.description} | Auto-created during 2025 payment sync`,
            receiptGenerated: false,
            createdAt: new Date().toISOString(),
          };
          
          await addDoc(collection(db, 'payments'), paymentData);
          
          console.log(`  ✅ Created: ${invoice.clientName} - $${invoice.amount.toFixed(2)} (${paymentDate})`);
          details.push({
            clientName: invoice.clientName,
            amount: invoice.amount,
            date: paymentDate,
            status: 'created'
          });
          created++;
        } catch (err) {
          console.log(`  ❌ Error: ${err.message}`);
          details.push({
            clientName: invoice.clientName,
            amount: invoice.amount,
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
      setProgress('All missing payments created!');
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
      setPhase('compared');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CompareArrowsIcon sx={{ mr: 1, fontSize: 30 }} />
        <Typography variant="h5" fontWeight="bold">
          🔍 Side-by-Side Comparison - 2025 Data
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <strong>This will show you EXACTLY what's missing!</strong>
        <br />
        LEFT: All paid invoices from 2025
        <br />
        RIGHT: All payments from 2025
        <br />
        THEN: Create the specific missing payment records with correct dates
      </Alert>

      {/* Ready to compare */}
      {phase === 'ready' && (
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<CompareArrowsIcon />}
          onClick={runComparison}
        >
          Compare 2025 Paid Invoices vs Payments
        </Button>
      )}

      {/* Comparing */}
      {phase === 'comparing' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Show comparison */}
      {phase === 'compared' && comparison && (
        <>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {/* LEFT: Paid Invoices */}
            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'success.light', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📄 PAID INVOICES 2025
                  </Typography>
                  <Typography variant="h4" color="success.dark">
                    {comparison.paidInvoices2025.length} invoices
                  </Typography>
                  <Typography variant="h5" color="success.dark">
                    ${comparison.invoiceTotal.toFixed(2)}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <List dense sx={{ maxHeight: 400, overflowY: 'auto' }}>
                    {comparison.paidInvoices2025.map((inv, idx) => {
                      const dateStr = inv.date.toDate ? inv.date.toDate().toLocaleDateString() : new Date(inv.date).toLocaleDateString();
                      const hasPmt = comparison.payments2025.find(p => p.invoiceId === inv.id);
                      return (
                        <ListItem key={idx} sx={{ bgcolor: hasPmt ? 'transparent' : 'error.light' }}>
                          <ListItemText
                            primary={`${inv.clientName} - $${inv.amount.toFixed(2)}`}
                            secondary={`${dateStr} ${!hasPmt ? '⚠️ NO PAYMENT RECORD' : '✅'}`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* RIGHT: Payments */}
            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'primary.light', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    💰 PAYMENTS 2025
                  </Typography>
                  <Typography variant="h4" color="primary.dark">
                    {comparison.payments2025.length} payments
                  </Typography>
                  <Typography variant="h5" color="primary.dark">
                    ${comparison.paymentTotal.toFixed(2)}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <List dense sx={{ maxHeight: 400, overflowY: 'auto' }}>
                    {comparison.payments2025.map((pmt, idx) => {
                      const dateStr = pmt.date.toDate ? pmt.date.toDate().toLocaleDateString() : new Date(pmt.date).toLocaleDateString();
                      return (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={`${pmt.clientName || 'NO NAME'} - $${pmt.amount.toFixed(2)}`}
                            secondary={`${dateStr} ${pmt.invoiceId ? '🔗 Linked' : '⚠️ Not linked'}`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Missing payments alert */}
          <Alert severity="error" sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              ❌ MISSING {comparison.missingPayments.length} PAYMENT RECORDS
            </Typography>
            <Typography variant="body2">
              <strong>Total missing: ${comparison.missingTotal.toFixed(2)}</strong>
            </Typography>
            <Box sx={{ mt: 2 }}>
              {comparison.missingPayments.map((inv, idx) => {
                const dateStr = inv.date.toDate ? inv.date.toDate().toLocaleDateString() : new Date(inv.date).toLocaleDateString();
                return (
                  <Chip 
                    key={idx}
                    label={`${inv.clientName} - $${inv.amount.toFixed(2)} (${dateStr})`}
                    color="error"
                    sx={{ m: 0.5 }}
                  />
                );
              })}
            </Box>
          </Alert>

          {comparison.missingPayments.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<FixIcon />}
                onClick={createMissingPayments}
              >
                Create {comparison.missingPayments.length} Missing Payment Records
              </Button>
            </Box>
          )}

          {comparison.missingPayments.length === 0 && (
            <Alert severity="success" sx={{ mt: 3 }}>
              ✅ Perfect! All 2025 paid invoices have payment records!
            </Alert>
          )}
        </>
      )}

      {/* Fixing */}
      {phase === 'fixing' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Complete */}
      {phase === 'complete' && results && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            🎉 All Missing 2025 Payments Created!
          </Typography>
          <Typography variant="body2">
            <strong>✅ Created {results.created} payment records</strong>
            <br />
            <strong>❌ Errors: {results.errors}</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 'bold' }}>
            🎯 Go to Payments Dashboard, set filter to 2025, and refresh! You should see {results.created} more payments!
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

export default SideBySideComparison;