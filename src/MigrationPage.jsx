import React, { useState } from 'react';
import { Container, Paper, Button, Typography, Box, Alert } from '@mui/material';
import { migrateDocumentsWithTokens } from './utils/migrateTokens';
import Swal from 'sweetalert2';

export default function MigrationPage() {
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState(null);

  const handleMigration = async () => {
    const confirmed = await Swal.fire({
      title: '🔐 Migrate Security Tokens?',
      html: `
        <p>This will add security tokens to all existing:</p>
        <ul style="text-align: left; margin: 20px auto; max-width: 300px;">
          <li>Bids</li>
          <li>Contracts</li>
          <li>Invoices</li>
        </ul>
        <p><strong>This is safe and won't break anything!</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, migrate now!',
    });

    if (!confirmed.isConfirmed) return;

    setMigrating(true);

    try {
      const migrationResults = await migrateDocumentsWithTokens();
      setResults(migrationResults);
      
      await Swal.fire({
        icon: 'success',
        title: '✅ Migration Complete!',
        html: `
          <div style="text-align: left; margin: 20px auto; max-width: 400px;">
            <p><strong>Security tokens added:</strong></p>
            <ul>
              <li><strong>Bids:</strong> ${migrationResults.bids.updated} of ${migrationResults.bids.total} updated</li>
              <li><strong>Contracts:</strong> ${migrationResults.contracts.updated} of ${migrationResults.contracts.total} updated</li>
              <li><strong>Invoices:</strong> ${migrationResults.invoices.updated} of ${migrationResults.invoices.total} updated</li>
            </ul>
            <p style="margin-top: 20px; color: green;">
              🔐 All documents are now secure!
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Migration error:', error);
      Swal.fire('Error', 'Migration failed: ' + error.message, 'error');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          🔐 Security Token Migration
        </Typography>
        
        <Typography variant="body1" paragraph>
          This tool will add security tokens to all existing bids, contracts, and invoices
          that don't have them yet.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          This is a one-time operation. New documents will automatically get tokens.
        </Alert>

        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleMigration}
          disabled={migrating}
        >
          {migrating ? 'Migrating...' : 'Start Migration'}
        </Button>

        {results && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="h6">Migration Results:</Typography>
            <Typography>✅ Bids: {results.bids.updated} of {results.bids.total} updated</Typography>
            <Typography>✅ Contracts: {results.contracts.updated} of {results.contracts.total} updated</Typography>
            <Typography>✅ Invoices: {results.invoices.updated} of {results.invoices.total} updated</Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}