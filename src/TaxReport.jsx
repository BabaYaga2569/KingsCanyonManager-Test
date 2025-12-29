import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Divider,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ReceiptIcon from "@mui/icons-material/Receipt";
import moment from "moment";

export default function TaxReport() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: moment().startOf("year").format("YYYY-MM-DD"),
    endDate: moment().endOf("year").format("YYYY-MM-DD"),
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const expensesSnap = await getDocs(collection(db, "expenses"));
      const expensesData = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExpenses(expensesData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading expenses:", error);
      setLoading(false);
    }
  };

  const getFilteredExpenses = () => {
    return expenses.filter((expense) => {
      const expenseDate = moment(expense.date);
      const inDateRange =
        expenseDate.isSameOrAfter(moment(dateRange.startDate)) &&
        expenseDate.isSameOrBefore(moment(dateRange.endDate));
      return inDateRange && expense.taxDeductible;
    });
  };

  const getTotalByCategory = () => {
    const filtered = getFilteredExpenses();
    const totals = {};
    filtered.forEach((expense) => {
      const category = expense.category || "other";
      totals[category] = (totals[category] || 0) + parseFloat(expense.amount || 0);
    });
    return totals;
  };

  const handleExportCSV = () => {
    const filtered = getFilteredExpenses();
    const csvContent = [
      ["Date", "Category", "Vendor", "Amount", "Description", "Job", "Payment Method", "Receipt"].join(","),
      ...filtered.map((e) =>
        [
          e.date,
          e.category,
          `"${e.vendor}"`,
          e.amount,
          `"${e.description || ""}"`,
          `"${e.jobName}"`,
          e.paymentMethod,
          e.receiptUrl ? "Yes" : "No",
        ].join(",")
      ),
      ["", "", "TOTAL:", filtered.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0).toFixed(2)],
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax_report_${dateRange.startDate}_to_${dateRange.endDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading tax data...
        </Typography>
      </Container>
    );
  }

  const filteredExpenses = getFilteredExpenses();
  const totalDeductible = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const categoryTotals = getTotalByCategory();
  const expensesWithReceipts = filteredExpenses.filter((e) => e.receiptUrl).length;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5">🧾 Tax Deduction Report</Typography>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
          Export for Accountant
        </Button>
      </Box>

      {/* Date Range Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Tax Year / Date Range
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Start Date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="End Date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() =>
                setDateRange({
                  startDate: moment().startOf("year").format("YYYY-MM-DD"),
                  endDate: moment().endOf("year").format("YYYY-MM-DD"),
                })
              }
            >
              Current Tax Year
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Tax Deductions
              </Typography>
              <Typography variant="h3" color="success.main" sx={{ my: 2 }}>
                ${totalDeductible.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredExpenses.length} deductible expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Estimated Tax Savings
              </Typography>
              <Typography variant="h3" color="primary" sx={{ my: 2 }}>
                ${(totalDeductible * 0.3).toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                At 30% tax rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Receipts Available
              </Typography>
              <Typography variant="h3" color="info.main" sx={{ my: 2 }}>
                {expensesWithReceipts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                of {filteredExpenses.length} expenses ({((expensesWithReceipts / filteredExpenses.length) * 100).toFixed(0)}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category Breakdown */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📊 Deductions by Category
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([category, total]) => (
              <Grid item xs={12} sm={6} md={4} key={category}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
                  <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                    {category === "materials" && "🧱 Materials"}
                    {category === "fuel" && "⛽ Fuel"}
                    {category === "equipment" && "🚜 Equipment"}
                    {category === "labor" && "👷 Labor"}
                    {category === "insurance" && "🏢 Insurance"}
                    {category === "tools" && "🔧 Tools"}
                    {category === "software" && "📱 Software"}
                    {category === "vehicle" && "🚗 Vehicle"}
                    {category === "permits" && "📋 Permits"}
                    {category === "other" && "💼 Other"}
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ${total.toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
            ))}
        </Grid>
        <Box sx={{ mt: 3, p: 2, bgcolor: "success.light", borderRadius: 1 }}>
          <Typography variant="h6" align="center" color="success.dark">
            TOTAL DEDUCTIONS: ${totalDeductible.toFixed(2)}
          </Typography>
        </Box>
      </Paper>

      {/* Detailed List */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📋 Detailed Expense List
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{moment(expense.date).format("MM/DD/YYYY")}</TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>{expense.category}</TableCell>
                    <TableCell>{expense.vendor}</TableCell>
                    <TableCell>{expense.description || "—"}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">${parseFloat(expense.amount).toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell>
                      {expense.receiptUrl ? (
                        <Button size="small" startIcon={<ReceiptIcon />} onClick={() => window.open(expense.receiptUrl, "_blank")}>
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
                  <Typography variant="h6">TOTAL:</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="h6" color="success.main">
                    ${totalDeductible.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}