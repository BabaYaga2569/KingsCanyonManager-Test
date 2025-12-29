import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Grid,
  Divider,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import moment from "moment";
import PaymentIcon from "@mui/icons-material/Payment";
import FilterListIcon from "@mui/icons-material/FilterList";
import DownloadIcon from "@mui/icons-material/Download";

export default function PaymentsDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [filters, setFilters] = useState({
    startDate: moment().subtract(30, "days").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
    paymentMethod: "all",
    searchClient: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all payments
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentsData = paymentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Load all invoices
      const invoicesSnap = await getDocs(collection(db, "invoices"));
      const invoicesData = invoicesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setPayments(paymentsData);
      setInvoices(invoicesData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading payments:", error);
      setLoading(false);
    }
  };

  const getFilteredPayments = () => {
    return payments.filter((payment) => {
      // Date filter
      const paymentDate = moment(payment.paymentDate);
      const inDateRange =
        paymentDate.isSameOrAfter(moment(filters.startDate)) &&
        paymentDate.isSameOrBefore(moment(filters.endDate));

      // Payment method filter
      const matchesMethod =
        filters.paymentMethod === "all" ||
        payment.paymentMethod === filters.paymentMethod;

      // Client name filter
      const matchesClient =
        !filters.searchClient ||
        payment.clientName
          .toLowerCase()
          .includes(filters.searchClient.toLowerCase());

      return inDateRange && matchesMethod && matchesClient;
    });
  };

  const getTotalRevenue = () => {
    const filtered = getFilteredPayments();
    return filtered.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  };

  const getRevenueByMethod = () => {
    const filtered = getFilteredPayments();
    const byMethod = {};

    filtered.forEach((payment) => {
      const method = payment.paymentMethod || "other";
      if (!byMethod[method]) {
        byMethod[method] = 0;
      }
      byMethod[method] += parseFloat(payment.amount || 0);
    });

    return byMethod;
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      cash: "Cash",
      check: "Check",
      zelle: "Zelle",
      credit_card: "Credit Card",
      venmo: "Venmo",
      paypal: "PayPal",
      other: "Other",
    };
    return methods[method] || method;
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      cash: "success",
      check: "info",
      zelle: "primary",
      credit_card: "secondary",
      venmo: "info",
      paypal: "primary",
      other: "default",
    };
    return colors[method] || "default";
  };

  const handleExportCSV = () => {
    const filtered = getFilteredPayments();
    
    const csvContent = [
      ["Date", "Client", "Amount", "Method", "Reference", "Notes"].join(","),
      ...filtered.map((p) =>
        [
          p.paymentDate,
          `"${p.clientName}"`,
          p.amount,
          getPaymentMethodLabel(p.paymentMethod),
          `"${p.reference || ""}"`,
          `"${p.notes || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${moment().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading payments...
        </Typography>
      </Container>
    );
  }

  const filteredPayments = getFilteredPayments();
  const totalRevenue = getTotalRevenue();
  const revenueByMethod = getRevenueByMethod();

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 6 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h5">💰 Payments Dashboard</Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportCSV}
          size="small"
        >
          Export CSV
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Revenue (Filtered)
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ my: 1 }}>
                ${totalRevenue.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredPayments.length} payments
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Revenue by Payment Method
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
                {Object.entries(revenueByMethod).map(([method, amount]) => (
                  <Box key={method} sx={{ minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary">
                      {getPaymentMethodLabel(method)}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ${amount.toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <FilterListIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Filters</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={filters.paymentMethod}
                label="Payment Method"
                onChange={(e) =>
                  setFilters({ ...filters, paymentMethod: e.target.value })
                }
              >
                <MenuItem value="all">All Methods</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="check">Check</MenuItem>
                <MenuItem value="zelle">Zelle</MenuItem>
                <MenuItem value="credit_card">Credit Card</MenuItem>
                <MenuItem value="venmo">Venmo</MenuItem>
                <MenuItem value="paypal">PayPal</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Search Client"
              value={filters.searchClient}
              onChange={(e) =>
                setFilters({ ...filters, searchClient: e.target.value })
              }
              fullWidth
              size="small"
              placeholder="Client name..."
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Payments List */}
      {isMobile ? (
        // Mobile: Card View
        <Box>
          {filteredPayments.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">
                No payments found for selected filters
              </Typography>
            </Paper>
          ) : (
            filteredPayments
              .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
              .map((payment) => (
                <Card key={payment.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6">{payment.clientName}</Typography>
                      <Typography variant="h6" color="success.main">
                        ${parseFloat(payment.amount).toFixed(2)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {moment(payment.paymentDate).format("MMM DD, YYYY")}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={getPaymentMethodLabel(payment.paymentMethod)}
                        color={getPaymentMethodColor(payment.paymentMethod)}
                        size="small"
                      />
                    </Box>
                    {payment.reference && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Ref: {payment.reference}
                      </Typography>
                    )}
                    {payment.notes && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        {payment.notes}
                      </Typography>
                    )}
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(`/payment-tracker/${payment.invoiceId}`)
                      }
                      sx={{ mt: 1 }}
                    >
                      View Invoice
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </Box>
      ) : (
        // Desktop: Table View
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No payments found for selected filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments
                  .sort(
                    (a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)
                  )
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {moment(payment.paymentDate).format("MMM DD, YYYY")}
                      </TableCell>
                      <TableCell>{payment.clientName}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          color="success.main"
                        >
                          ${parseFloat(payment.amount).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getPaymentMethodLabel(payment.paymentMethod)}
                          color={getPaymentMethodColor(payment.paymentMethod)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{payment.reference || "—"}</TableCell>
                      <TableCell>{payment.notes || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() =>
                            navigate(`/payment-tracker/${payment.invoiceId}`)
                          }
                        >
                          View Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}