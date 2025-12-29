import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AddIcon from "@mui/icons-material/Add";
import moment from "moment";

export default function JobExpenses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [invoice, setInvoice] = useState(null);

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

  const materialCosts = expenses
    .filter((e) => e.category === "materials")
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  
  const laborCosts = expenses
    .filter((e) => e.category === "labor")
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  const expensesByCategory = {};
  expenses.forEach((expense) => {
    const cat = expense.category || "other";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(expense.amount || 0);
  });

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/jobs")} variant="outlined">
          Back to Jobs
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          💰 Job Expenses: {job.clientName}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/expenses-manager")}
        >
          Add Expense
        </Button>
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
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {expense.description}
                    </Typography>
                    {expense.receiptUrl && (
                      <Button
                        size="small"
                        startIcon={<ReceiptIcon />}
                        onClick={() => window.open(expense.receiptUrl, "_blank")}
                        sx={{ mt: 1 }}
                      >
                        View Receipt
                      </Button>
                    )}
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
                        {expense.receiptUrl ? (
                          <Button
                            size="small"
                            startIcon={<ReceiptIcon />}
                            onClick={() => window.open(expense.receiptUrl, "_blank")}
                          >
                            View
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
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
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}