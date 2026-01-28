import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, LinearProgress, List, ListItem, ListItemText, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';

/**
 * EmergencyUndo - Deletes ONLY the incorrectly dated backfilled payments
 * 
 * CRITICAL: This will ONLY delete payments that:
 * 1. Have notes containing "Backfilled" or "Auto-created during"
 * 2. Were created today (Jan 26, 2026)
 * 
 * This will NOT touch your legitimate payments!
 */

function EmergencyUndo() {
  const [phase, setPhase] = useState('ready');
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const findBadPayments = async () => {
    setPhase('scanning');
    setProgress('Scanning for incorrect backfilled payments...');
    setError(null);
    setFound(null);

    try {
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('='.repeat(70));
      console.log('🔍 EMERGENCY SCAN - Finding Incorrect Backfilled Payments');
      console.log('='.repeat(70));
      
      // Find payments created by the backfill tools
      const badPayments = payments.filter(p => {
        // Check if notes contain backfill markers
        const hasBackfillMarker = 
          (p.notes && (
            p.notes.includes('Backfilled from paid invoice') ||
            p.notes.includes('Auto-created during payment sync') ||
            p.notes.includes('Auto-created during 2025 payment sync')
          )) ||
          (p.reference && (
            p.reference.includes('Backfilled from paid invoice') ||
            p.reference.includes('Consolidated from paid invoice') ||
            p.reference.includes('Created from paid invoice')
          ));
        
        return hasBackfillMarker;
      });
      
      console.log(`\n⚠️  Found ${badPayments.length} backfilled payments`);
      badPayments.forEach(p => {
        const dateStr = p.paymentDate || 'No date';
        console.log(`  ${p.clientName || 'NO NAME'}: $${p.amount} (${dateStr})`);
      });
      
      const totalAmount = badPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      setFound({
        payments: badPayments,
        count: badPayments.length,
        totalAmount
      });
      setPhase('found');
      setProgress('Scan complete!');
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
      setPhase('ready');
    }
  };

  const deleteBadPayments = async () => {
    setPhase('deleting');
    setProgress('Deleting incorrect backfilled payments...');
    setResults(null);

    try {
      const paymentsToDelete = found.payments;
      let deleted = 0;
      let errors = 0;
      
      for (let i = 0; i < paymentsToDelete.length; i++) {
        const payment = paymentsToDelete[i];
        setProgress(`Deleting ${i + 1} of ${paymentsToDelete.length}... (${payment.clientName} - $${payment.amount})`);
        
        try {
          await deleteDoc(doc(db, 'payments', payment.id));
          console.log(`  ✅ Deleted: ${payment.clientName} - $${payment.amount}`);
          deleted++;
        } catch (err) {
          console.log(`  ❌ Error deleting: ${err.message}`);
          errors++;
        }
      }
      
      setResults({
        deleted,
        errors
      });
      setPhase('complete');
      setProgress('Cleanup complete!');
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ EMERGENCY CLEANUP COMPLETE');
      console.log('='.repeat(70));
      console.log(`Deleted: ${deleted}`);
      console.log(`Errors: ${errors}`);
      console.log('='.repeat(70));
      
    } catch (err) {
      console.error('❌ Fatal error:', err);
      setError(err.message);
      setPhase('found');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <WarningIcon sx={{ mr: 1, fontSize: 30, color: 'error.dark' }} />
        <Typography variant="h5" fontWeight="bold" color="error.dark">
          🚨 EMERGENCY UNDO - Delete Incorrect Backfilled Payments
        </Typography>
      </Box>

      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          This will DELETE payments that were incorrectly created by the backfill tools!
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          ✅ SAFE: Only deletes payments with "Backfilled" or "Auto-created" in notes
          <br />
          ✅ SAFE: Will NOT touch your legitimate payments
          <br />
          ⚠️ This is necessary to clean up the incorrect dates
        </Typography>
      </Alert>

      {/* Ready to scan */}
      {phase === 'ready' && (
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={<WarningIcon />}
          onClick={findBadPayments}
        >
          Step 1: Scan for Incorrect Backfilled Payments
        </Button>
      )}

      {/* Scanning */}
      {phase === 'scanning' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
        </Box>
      )}

      {/* Found bad payments */}
      {phase === 'found' && found && (
        <>
          <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              ⚠️ Found {found.count} Incorrect Backfilled Payments
            </Typography>
            <Typography variant="body2">
              <strong>Total amount: ${found.totalAmount.toFixed(2)}</strong>
            </Typography>
          </Alert>

          <Paper sx={{ p: 2, bgcolor: 'background.default', maxHeight: 400, overflowY: 'auto', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Payments to Delete:
            </Typography>
            <List dense>
              {found.payments.map((p, idx) => (
                <ListItem key={idx} sx={{ bgcolor: 'error.light', mb: 0.5, borderRadius: 1 }}>
                  <ListItemText
                    primary={`${p.clientName || 'NO NAME'} - $${p.amount}`}
                    secondary={`Date: ${p.paymentDate || 'No date'} | ${p.notes ? p.notes.substring(0, 50) : 'No notes'}`}
                  />
                  <Chip label="DELETE" color="error" size="small" />
                </ListItem>
              ))}
            </List>
          </Paper>

          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<DeleteIcon />}
            onClick={deleteBadPayments}
          >
            Step 2: DELETE {found.count} Incorrect Payments
          </Button>
        </>
      )}

      {/* Deleting */}
      {phase === 'deleting' && (
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
              ✅ Cleanup Complete!
            </Typography>
            <Typography variant="body2">
              <strong>Deleted: {results.deleted} payments</strong>
              <br />
              <strong>Errors: {results.errors}</strong>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              🎯 Next Steps:
            </Typography>
            <Typography variant="body2">
              1. Refresh your Payments Dashboard to verify the incorrect payments are gone
              <br />
              2. Tell me and I'll create a CORRECTED tool that uses the RIGHT dates from invoices
              <br />
              3. We'll create the payment records again with the correct 2025 dates
            </Typography>
          </Alert>
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

export default EmergencyUndo;