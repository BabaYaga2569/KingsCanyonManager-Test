import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container, Typography, Box, Paper, Button, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Divider, useMediaQuery, useTheme,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import moment from "moment";
import Swal from "sweetalert2";
import { exportJobExpensesToExcel } from "./utils/exportJobExpensesToExcel";
import { generateJobExpenseReport } from "./pdf/generateJobExpenseReport";

export default function JobExpenses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [viewingItems, setViewingItems] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load job
      const jobDoc = await getDoc(doc(db, "jobs", id));
      if (jobDoc.exists()) {
        setJob({ id: jobDoc.id, ...jobDoc.data() });
      }

      // Load expenses for this job
      const expensesSnap = await getDocs(collection(db, "expenses"));
      const jobExpenses = expensesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.jobId === id);
      setExpenses(jobExpenses);

      // Try to load invoice for revenue
      const invoicesSnap = await getDocs(collection(db, "invoices"));
      const jobInvoice = invoicesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((inv) => inv.jobId === id);
      setInvoice(jobInvoice);

      setLoading(false);
    } catch (error) {
      console.error("Error loading job expenses:", error);
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    const result = await Swal.fire({
      title: 'Mark Job Complete?',
      html: `
        <div style="text-align: left;">
          <p><strong>This will:</strong></p>
          <ul>
            <li>✅ Lock all expenses (no more changes)</li>
            <li>📄 Generate final expense report PDF</li>
            <li>✓ Update job status to Complete</li>
          </ul>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Mark Complete',
      confirmButtonColor: '#4caf50',
      cancelButtonColor: '#999',
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: 'Generating Report...',
          text: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        // Generate PDF report
        await generateJobExpenseReport(job, expenses, invoice);

        // Update job status
        await updateDoc(doc(db, 'jobs', id), {
          status: 'complete',
          completedAt: new Date().toISOString(),
          expensesLocked: true,
        });

        Swal.fire({
          icon: 'success',
          title: 'Job Marked Complete!',
          html: `
            <p>✅ Job status updated</p>
            <p>📄 Expense report PDF downloaded</p>
            <p>🔒 Expenses are now locked</p>
          `,
        });

        loadData();
      } catch (error) {
        console.error('Error marking complete:', error);
        Swal.fire('Error', 'Failed to mark job complete: ' + error.message, 'error');
      }
    }
  };

  const handleDeleteExpense = async (expenseId, expenseVendor) => {
    const result = await Swal.fire({
      title: 'Delete Expense?',
      text: `Delete expense from ${expenseVendor}? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#f44336',
      cancelButtonColor: '#999',
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
        Swal.fire('Deleted!', 'Expense has been deleted', 'success');
        loadData();
      } catch (error) {
        console.error('Error deleting expense:', error);
        Swal.fire('Error', 'Failed to delete expense', 'error');
      }
    }
  };

  const handleEditExpense = (expense) => {
    // Navigate to expenses manager with edit parameter
    navigate(`/expenses-manager?edit=${expense.id}`);
  };

  const handleExportExcel = () => {
    try {
      exportJobExpensesToExcel(job, expenses, invoice);
      Swal.fire({
        icon: 'success',
        title: 'Excel Export Complete!',
        text: 'Check your Downloads folder',
        timer: 2000,
      });
    } catch (error) {
      console.error('Excel export error:', error);
      Swal.fire('Error', 'Failed to export to Excel', 'error');
    }
  };

  const handleGeneratePDF = async () => {
    try {
      Swal.fire({
        title: 'Generating PDF...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await generateJobExpenseReport(job, expenses, invoice);

      Swal.fire({
        icon: 'success',
        title: 'PDF Generated!',
        text: 'Check your Downloads folder',
        timer: 2000,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      Swal.fire('Error', 'Failed to generate PDF', 'error');
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading job expenses...
        </Typography>
      </Container>
    );
  }

  if (!job) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Job not found</Typography>
        <Button onClick={() => navigate("/jobs")} startIcon={<ArrowBackIcon />}>
          Back to Jobs
        </Button>
      </Container>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const revenue = invoice ? parseFloat(invoice.total || invoice.amount || 0) : 0;
  const profit = revenue - totalExpenses;
  const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

  const expensesByCategory = {};
  expenses.forEach((expense) => {
    const cat = expense.category || "other";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(expense.amount || 0);
  });

  const isLocked = job.expensesLocked || job.status === 'complete';

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/jobs")} variant="outlined">
          Back to Jobs
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          💰 Job Expenses: {job.clientName}
        </Typography>
        {isLocked && (
          <Chip
            icon={<LockIcon />}
            label="Expenses Locked"
            color="warning"
          />
        )}
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/expenses-manager")}
          disabled={isLocked}
        >
          Add Expense
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportExcel}
          disabled={expenses.length === 0}
        >
          Export Excel
        </Button>
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          onClick={handleGeneratePDF}
          disabled={expenses.length === 0}
        >
          Generate PDF
        </Button>
        {job.status !== 'complete' && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleMarkComplete}
          >
            Mark Complete
          </Button>
        )}
      </Box>

      {/* Profitability Summary */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: "primary.light" }}>
        <Typography variant="h6" gutterBottom>
          📊 Job Profitability
        </Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Revenue
              </Typography>
              <Typography variant="h4" color="primary.dark">
                ${revenue.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Expenses
              </Typography>
              <Typography variant="h4" color="error.main">
                ${totalExpenses.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Profit
              </Typography>
              <Typography variant="h4" color={profit >= 0 ? "success.main" : "error.main"}>
                ${profit.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Profit Margin
              </Typography>
              <Typography variant="h4" color={profit >= 0 ? "success.main" : "error.main"}>
                {profitMargin}%
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Expense Breakdown */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💰 Expense Categories
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {Object.entries(expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, total]) => (
                  <Box
                    key={category}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                      p: 1,
                      bgcolor: "#f5f5f5",
                      borderRadius: 1,
                    }}
                  >
                    <Typography sx={{ textTransform: "capitalize" }}>
                      {category}
                    </Typography>
                    <Typography fontWeight="bold" color="error.main">
                      ${total.toFixed(2)}
                    </Typography>
                  </Box>
                ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Expense Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Expenses
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    ${totalExpenses.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Number of Expenses
                  </Typography>
                  <Typography variant="h5">{expenses.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Receipts Collected
                  </Typography>
                  <Typography variant="h5">
                    {expenses.filter((e) => e.receiptUrl).length} of {expenses.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Tax Deductible
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ${expenses
                      .filter((e) => e.taxDeductible)
                      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
                      .toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Expense List */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📝 All Expenses
        </Typography>
        {expenses.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            No expenses recorded for this job yet
          </Typography>
        ) : isMobile ? (
          <Box>
            {expenses
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((expense) => (
                <Card key={expense.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="h6">{expense.vendor}</Typography>
                      <Typography variant="h6" color="error.main">
                        ${parseFloat(expense.amount).toFixed(2)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {moment(expense.date).format("MMM DD, YYYY")}
                    </Typography>
                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip label={expense.category} size="small" />
                      {expense.taxDeductible && (
                        <Chip label="Tax Deductible" color="success" size="small" />
                      )}
                      {expense.receiptUrl && (
                        <Chip icon={<ReceiptIcon />} label="Receipt" size="small" />
                      )}
                      {expense.lineItems && expense.lineItems.length > 0 && (
                        <Chip label={`${expense.lineItems.length} items`} size="small" color="primary" />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {expense.description}
                    </Typography>
                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                      {expense.receiptUrl && (
                        <Button
                          size="small"
                          startIcon={<ReceiptIcon />}
                          onClick={() => window.open(expense.receiptUrl, "_blank")}
                        >
                          View Receipt
                        </Button>
                      )}
                      {expense.lineItems && expense.lineItems.length > 0 && (
                        <Button
                          size="small"
                          onClick={() => setViewingItems(expense)}
                        >
                          View Items
                        </Button>
                      )}
                      {!isLocked && (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => handleEditExpense(expense)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteExpense(expense.id, expense.vendor)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Receipt</TableCell>
                  {!isLocked && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{moment(expense.date).format("MMM DD, YYYY")}</TableCell>
                      <TableCell>{expense.vendor}</TableCell>
                      <TableCell>
                        <Chip label={expense.category} size="small" />
                      </TableCell>
                      <TableCell>{expense.description || "—"}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="error.main">
                          ${parseFloat(expense.amount).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {expense.receiptUrl && (
                            <Button
                              size="small"
                              startIcon={<ReceiptIcon />}
                              onClick={() => window.open(expense.receiptUrl, "_blank")}
                            >
                              View
                            </Button>
                          )}
                          {expense.lineItems && expense.lineItems.length > 0 && (
                            <Button
                              size="small"
                              onClick={() => setViewingItems(expense)}
                              variant="text"
                            >
                              ({expense.lineItems.length} items)
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                      {!isLocked && (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleEditExpense(expense)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteExpense(expense.id, expense.vendor)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell colSpan={4} align="right">
                    <Typography variant="h6">TOTAL EXPENSES:</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="h6" color="error.main">
                      ${totalExpenses.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell colSpan={isLocked ? 1 : 2} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Itemized Receipt Dialog */}
      <Dialog
        open={Boolean(viewingItems)}
        onClose={() => setViewingItems(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Itemized Receipt - {viewingItems?.vendor}
          <Typography variant="caption" display="block" color="text.secondary">
            {viewingItems && moment(viewingItems.date).format("MMMM DD, YYYY")}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {viewingItems?.lineItems && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell>Item</TableCell>
                    <TableCell align="center">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewingItems.lineItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.item}</TableCell>
                      <TableCell align="center">{item.quantity}</TableCell>
                      <TableCell align="right">${parseFloat(item.price).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        ${(parseFloat(item.quantity) * parseFloat(item.price)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell colSpan={3} align="right">
                      <strong>Receipt Total:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>${parseFloat(viewingItems.amount).toFixed(2)}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {viewingItems?.receiptUrl && (
            <Box sx={{ mt: 2 }}>
              <Button
                startIcon={<ReceiptIcon />}
                onClick={() => window.open(viewingItems.receiptUrl, "_blank")}
                variant="outlined"
                fullWidth
              >
                View Receipt Image
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingItems(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}