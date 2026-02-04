import React, { useState } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { migratePayments, findInvoicesMissingPayments } from "./utils/paymentMigration";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import WarningIcon from "@mui/icons-material/Warning";

/**
 * Payment Migration Tool
 * 
 * UI component for running payment migration to find and create
 * missing payment records for paid invoices.
 */
export default function PaymentMigrationTool() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [missingPayments, setMissingPayments] = useState([]);
  const [year, setYear] = useState(2025);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    setResults(null);
    setMissingPayments([]);
    
    try {
      console.log(`🔍 Scanning for missing payment records in ${year}...`);
      const missing = await findInvoicesMissingPayments(year);
      setMissingPayments(missing);
      
      if (missing.length === 0) {
        setResults({
          message: `✅ No missing payment records found for ${year}! All paid invoices have corresponding payment records.`,
          type: "success",
        });
      } else {
        setResults({
          message: `⚠️ Found ${missing.length} paid invoice(s) without payment records`,
          type: "warning",
        });
      }
    } catch (error) {
      console.error("Error scanning for missing payments:", error);
      setResults({
        message: `❌ Error scanning: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setConfirmDialogOpen(false);
    setLoading(true);
    
    try {
      console.log(`🚀 Running migration for ${year}...`);
      const migrationResults = await migratePayments(year, false); // false = LIVE mode
      
      setResults({
        message: `✅ Migration complete! Created ${migrationResults.successful} payment record(s)`,
        type: "success",
        details: migrationResults,
      });
      
      // Clear missing payments list
      setMissingPayments([]);
    } catch (error) {
      console.error("Error running migration:", error);
      setResults({
        message: `❌ Migration failed: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDryRun = async () => {
    setLoading(true);
    
    try {
      console.log(`🧪 Running DRY RUN for ${year}...`);
      const migrationResults = await migratePayments(year, true); // true = DRY RUN mode
      
      setResults({
        message: `✅ Dry run complete! Would create ${migrationResults.successful} payment record(s)`,
        type: "info",
        details: migrationResults,
      });
    } catch (error) {
      console.error("Error running dry run:", error);
      setResults({
        message: `❌ Dry run failed: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        💰 Payment Migration Tool
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 3 }}>
        <strong>⚠️ IMPORTANT:</strong> This tool is designed to create missing payment records for invoices
        that were marked as "Paid" but never had payment records created. Always run a dry run first to preview
        changes before running the actual migration.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step 1: Scan for Missing Payments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scan the database to find paid invoices from {year} that don't have payment records.
          </Typography>
          
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleScan}
              disabled={loading}
            >
              Scan {year}
            </Button>
            
            {loading && <CircularProgress size={24} />}
          </Box>
        </CardContent>
      </Card>

      {results && (
        <Alert severity={results.type} sx={{ mb: 3 }}>
          {results.message}
        </Alert>
      )}

      {missingPayments.length > 0 && (
        <>
          <Paper sx={{ mb: 3, p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Missing Payment Records ({missingPayments.length})
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Invoice #</strong></TableCell>
                  <TableCell><strong>Client</strong></TableCell>
                  <TableCell><strong>Amount</strong></TableCell>
                  <TableCell><strong>Payment Date</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {missingPayments.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNumber || invoice.id.slice(-8)}</TableCell>
                    <TableCell>{invoice.clientName || "Unknown"}</TableCell>
                    <TableCell><strong>${invoice.total || invoice.amount || 0}</strong></TableCell>
                    <TableCell>
                      {invoice.paymentDate || invoice.invoiceDate || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Chip label="Paid" size="small" color="success" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Step 2: Create Payment Records
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose to run a dry run (preview) or create the payment records.
              </Typography>
              
              <Box sx={{ display: "flex", gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleDryRun}
                  disabled={loading}
                >
                  🧪 Dry Run (Preview)
                </Button>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={loading}
                >
                  Run Migration
                </Button>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      {results?.details && (
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Migration Results
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <Chip label={`Total: ${results.details.total}`} />
            <Chip label={`Successful: ${results.details.successful}`} color="success" />
            {results.details.failed > 0 && (
              <Chip label={`Failed: ${results.details.failed}`} color="error" />
            )}
          </Box>
          
          {results.details.errors.length > 0 && (
            <>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Errors:
              </Typography>
              {results.details.errors.map((err, idx) => (
                <Alert severity="error" key={idx} sx={{ mb: 1 }}>
                  Invoice #{err.invoiceNumber}: {err.error}
                </Alert>
              ))}
            </>
          )}
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="warning" />
          Confirm Migration
        </DialogTitle>
        <DialogContent>
          <Typography>
            This will create <strong>{missingPayments.length} payment record(s)</strong> in the database.
            This action cannot be easily undone.
          </Typography>
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Have you run a dry run to verify the changes?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMigrate} variant="contained" color="primary">
            Yes, Run Migration
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
