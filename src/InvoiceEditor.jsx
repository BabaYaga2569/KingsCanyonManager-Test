import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  MenuItem,
  Paper,
  Divider,
  Grid,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Alert,
  Card,
  CardContent,
} from "@mui/material";
import Swal from "sweetalert2";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const InvoiceEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Separate state for tax rate
  const [taxRate, setTaxRate] = useState(0);
  
  // NEW: Expense tracking state
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [includeMaterialBreakdown, setIncludeMaterialBreakdown] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const docRef = doc(db, "invoices", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setInvoice(data);
          // Set tax rate if it exists
          if (data.taxRate) {
            setTaxRate(data.taxRate);
          }
          // Set material breakdown preference if it exists
          if (data.includeMaterialBreakdown !== undefined) {
            setIncludeMaterialBreakdown(data.includeMaterialBreakdown);
          }
        } else {
          Swal.fire("Not found", "Invoice not found.", "error");
          navigate("/invoices");
        }
      } catch (e) {
        Swal.fire("Error", "Failed to load invoice.", "error");
        navigate("/invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, navigate]);

  // NEW: Load expenses for this job
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!invoice || !invoice.jobId) return;
      
      setLoadingExpenses(true);
      try {
        const expensesSnap = await getDocs(collection(db, "expenses"));
        const jobExpenses = expensesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e) => e.jobId === invoice.jobId);
        setExpenses(jobExpenses);
      } catch (error) {
        console.error("Error loading expenses:", error);
      } finally {
        setLoadingExpenses(false);
      }
    };
    
    if (invoice) {
      fetchExpenses();
    }
  }, [invoice?.jobId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInvoice({ ...invoice, [name]: value });
  };

  // Calculate tax when subtotal or tax rate changes
  useEffect(() => {
    if (invoice && invoice.subtotal !== undefined) {
      const subtotal = parseFloat(invoice.subtotal || invoice.amount || 0);
      const calculatedTax = (subtotal * taxRate) / 100;
      
      setInvoice(prev => ({
        ...prev,
        tax: calculatedTax,
        taxRate: taxRate,
      }));
    }
  }, [taxRate, invoice?.subtotal]);

  const handleTaxRateChange = (e) => {
    const rate = parseFloat(e.target.value) || 0;
    setTaxRate(rate);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "invoices", id);
      
      // Recalculate total when saving
      const subtotal = parseFloat(invoice.subtotal || invoice.amount || 0);
      const tax = parseFloat(invoice.tax || 0);
      const total = subtotal + tax;
      
      await updateDoc(docRef, {
        ...invoice,
        subtotal,
        tax,
        total,
        taxRate,
        includeMaterialBreakdown, // NEW: Save material breakdown preference
      });
      
      Swal.fire("Saved", "Invoice updated successfully.", "success");
    } catch (e) {
      console.error("Error saving invoice:", e);
      Swal.fire("Error", "Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading invoice...
        </Typography>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">No invoice data available.</Typography>
      </Container>
    );
  }

  const subtotal = parseFloat(invoice.subtotal || invoice.amount || 0);
  const tax = parseFloat(invoice.tax || 0);
  const total = subtotal + tax;
  
  // NEW: Calculate profit metrics
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const profit = total - totalExpenses;
  const profitMargin = total > 0 ? ((profit / total) * 100).toFixed(1) : 0;

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" gutterBottom>
        Edit Invoice — {invoice.clientName || "Unnamed"}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 900 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Client Information
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Client Name"
              name="clientName"
              value={invoice.clientName || ""}
              onChange={handleChange}
              fullWidth
              required
            />

            <TextField
              label="Client Email"
              name="clientEmail"
              type="email"
              value={invoice.clientEmail || ""}
              onChange={handleChange}
              fullWidth
              helperText="Email address for sending invoice"
            />

            <TextField
              label="Client Phone"
              name="clientPhone"
              value={invoice.clientPhone || ""}
              onChange={handleChange}
              fullWidth
              helperText="Contact phone number"
            />

            <TextField
              label="Client Address"
              name="clientAddress"
              multiline
              rows={2}
              value={invoice.clientAddress || ""}
              onChange={handleChange}
              fullWidth
              helperText="Billing address"
            />
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invoice Details
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Description"
              name="description"
              multiline
              rows={4}
              value={invoice.description || ""}
              onChange={handleChange}
              fullWidth
              helperText="Describe the work completed"
              required
            />

            <TextField
              label="Materials"
              name="materials"
              multiline
              rows={3}
              value={invoice.materials || ""}
              onChange={handleChange}
              fullWidth
              helperText="List materials used (will appear on invoice)"
            />

            <TextField
              label="Notes / Payment Instructions"
              name="notes"
              multiline
              rows={3}
              value={invoice.notes || ""}
              onChange={handleChange}
              fullWidth
              helperText="Payment terms, instructions, or special notes (will appear on invoice)"
            />
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pricing
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Subtotal"
              name="subtotal"
              type="number"
              value={invoice.subtotal || invoice.amount || ""}
              onChange={handleChange}
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: "0.01" }}
              helperText="Amount before tax"
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Tax Rate"
                  value={taxRate}
                  onChange={handleTaxRateChange}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="Select or enter tax rate for your area"
                >
                  <MenuItem value={0}>No Tax (0%)</MenuItem>
                  <MenuItem value={5}>5%</MenuItem>
                  <MenuItem value={5.6}>5.6% (Bullhead City, AZ)</MenuItem>
                  <MenuItem value={6}>6%</MenuItem>
                  <MenuItem value={7}>7%</MenuItem>
                  <MenuItem value={7.5}>7.5%</MenuItem>
                  <MenuItem value={8}>8%</MenuItem>
                  <MenuItem value={8.25}>8.25%</MenuItem>
                  <MenuItem value={8.5}>8.5%</MenuItem>
                  <MenuItem value={9}>9%</MenuItem>
                  <MenuItem value={10}>10%</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tax Amount (Auto-calculated)"
                  value={`$${tax.toFixed(2)}`}
                  fullWidth
                  disabled
                  helperText={`${taxRate}% of $${subtotal.toFixed(2)}`}
                  InputProps={{
                    style: { fontWeight: 'bold' }
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, bgcolor: "#f5f5f5", borderRadius: 2 }}>
              <Typography variant="h6">Total Amount:</Typography>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                ${total.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* NEW: PROFIT ANALYSIS - Internal Only */}
        {expenses.length > 0 && (
          <Paper sx={{ p: 3, bgcolor: '#f0f7ff', border: '2px solid #2196f3' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUpIcon color="primary" />
              <Typography variant="h6" color="primary">
                💰 Profit Analysis (Internal - Not Shown to Client)
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {loadingExpenses ? (
              <CircularProgress size={24} />
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Invoice Total (Revenue)
                    </Typography>
                    <Typography variant="h5" color="primary.main" fontWeight="bold">
                      ${total.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Your Costs (Expenses)
                    </Typography>
                    <Typography variant="h5" color="error.main" fontWeight="bold">
                      ${totalExpenses.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Your Profit
                    </Typography>
                    <Typography 
                      variant="h5" 
                      color={profit >= 0 ? "success.main" : "error.main"}
                      fontWeight="bold"
                    >
                      ${profit.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Profit Margin
                    </Typography>
                    <Typography 
                      variant="h4" 
                      color={profit >= 0 ? "success.main" : "error.main"}
                      fontWeight="bold"
                    >
                      {profitMargin}%
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    📊 Expense Breakdown:
                  </Typography>
                  {Object.entries(
                    expenses.reduce((acc, e) => {
                      const cat = e.category || 'other';
                      acc[cat] = (acc[cat] || 0) + parseFloat(e.amount || 0);
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <Box 
                        key={category}
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          p: 1,
                          mb: 0.5,
                          bgcolor: 'white',
                          borderRadius: 1
                        }}
                      >
                        <Typography sx={{ textTransform: 'capitalize' }}>
                          {category}:
                        </Typography>
                        <Typography fontWeight="bold" color="error.main">
                          ${amount.toFixed(2)}
                        </Typography>
                      </Box>
                    ))
                  }
                  
                  {invoice.jobId && (
                    <Button
                      size="small"
                      startIcon={<ReceiptLongIcon />}
                      onClick={() => navigate(`/job-expenses/${invoice.jobId}`)}
                      sx={{ mt: 2 }}
                      variant="outlined"
                      fullWidth
                    >
                      View All Expenses
                    </Button>
                  )}
                </Grid>
              </Grid>
            )}
          </Paper>
        )}

        {/* NEW: CLIENT MATERIAL BREAKDOWN OPTION */}
        {expenses.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ReceiptLongIcon />
              <Typography variant="h6">
                Client Options
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMaterialBreakdown}
                  onChange={(e) => setIncludeMaterialBreakdown(e.target.checked)}
                />
              }
              label="Include Material Cost Breakdown for Client (adds extra page to invoice PDF)"
            />
            
            {includeMaterialBreakdown && (
              <Alert severity="info" sx={{ mt: 2 }}>
                ✅ When generating the invoice PDF, an additional page will be included showing 
                itemized material costs from your expense receipts. This provides transparency 
                to clients who want to see actual material costs.
              </Alert>
            )}
          </Paper>
        )}

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invoice Status
          </Typography>
          <TextField
            select
            label="Status"
            name="status"
            value={invoice.status || "Pending"}
            onChange={handleChange}
            fullWidth
            helperText="Update status as invoice progresses"
          >
            <MenuItem value="Pending">Pending - Not sent yet</MenuItem>
            <MenuItem value="Sent">Sent - Emailed to client</MenuItem>
            <MenuItem value="Paid">Paid - Payment received ✅</MenuItem>
            <MenuItem value="Overdue">Overdue - Payment late</MenuItem>
          </TextField>
        </Paper>

        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={saving}
            sx={{ minWidth: 120 }}
            size="large"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={() => navigate("/invoices")}
            size="large"
          >
            Back to Invoices
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default InvoiceEditor;