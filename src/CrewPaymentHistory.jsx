import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import ReceiptIcon from "@mui/icons-material/Receipt";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import generateCrewPaymentReceipt from "./pdf/generateCrewPaymentReceipt";

export default function CrewPaymentHistory() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [crews, setCrews] = useState([]);
  const [filters, setFilters] = useState({
    crewId: "all",
    startDate: moment().subtract(90, "days").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
    paymentMethod: "all",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const paymentsSnap = await getDocs(collection(db, "crew_payments"));
      const paymentsData = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPayments(paymentsData);

      const crewsSnap = await getDocs(collection(db, "crews"));
      const crewsData = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      setLoading(false);
    } catch (error) {
      console.error("Error loading payment history:", error);
      setLoading(false);
    }
  };

  const getFilteredPayments = () => {
    return payments.filter((payment) => {
      const paymentDate = moment(payment.paymentDate);
      const inDateRange =
        paymentDate.isSameOrAfter(moment(filters.startDate)) &&
        paymentDate.isSameOrBefore(moment(filters.endDate));

      const matchesCrew = filters.crewId === "all" || payment.crewId === filters.crewId;
      const matchesMethod =
        filters.paymentMethod === "all" || payment.paymentMethod === filters.paymentMethod;

      return inDateRange && matchesCrew && matchesMethod;
    });
  };

  const getTotalPaid = () => {
    return getFilteredPayments().reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  };

  const handleExportCSV = () => {
    const filtered = getFilteredPayments();
    const csvContent = [
      ["Date", "Crew Member", "Job", "Hours", "Rate", "Amount", "Method", "Reference", "Notes"].join(","),
      ...filtered.map((p) =>
        [
          p.paymentDate,
          `"${p.crewName}"`,
          `"${p.jobName}"`,
          p.hoursWorked || 0,
          p.hourlyRate || 0,
          p.amount,
          p.paymentMethod,
          `"${p.reference || ""}"`,
          `"${p.notes || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crew_payroll_${moment().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const handleViewReceipt = async (payment) => {
    try {
      const crew = crews.find((c) => c.id === payment.crewId);
      const receipt = await generateCrewPaymentReceipt({ payment, crew });
      const receiptBlob = receipt.output("blob");
      const receiptUrl = URL.createObjectURL(receiptBlob);
      window.open(receiptUrl, "_blank");
    } catch (error) {
      console.error("Error generating receipt:", error);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading payment history...
        </Typography>
      </Container>
    );
  }

  const filteredPayments = getFilteredPayments();
  const totalPaid = getTotalPaid();

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/crew-payroll")}
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          💰 Crew Payment History
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportCSV}
          size="small"
        >
          Export CSV
        </Button>
      </Box>

      {/* Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Paid (Filtered)
              </Typography>
              <Typography variant="h4" color="error.main">
                ${totalPaid.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredPayments.length} payments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Average Payment
              </Typography>
              <Typography variant="h4" color="primary">
                ${filteredPayments.length > 0 ? (totalPaid / filteredPayments.length).toFixed(2) : "0.00"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Hours
              </Typography>
              <Typography variant="h4" color="info.main">
                {filteredPayments.reduce((sum, p) => sum + (parseFloat(p.hoursWorked) || 0), 0).toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
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
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="Crew Member"
              value={filters.crewId}
              onChange={(e) => setFilters({ ...filters, crewId: e.target.value })}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Crew Members</MenuItem>
              {crews.map((crew) => (
                <MenuItem key={crew.id} value={crew.id}>
                  {crew.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="Payment Method"
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Methods</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
              <MenuItem value="paypal">PayPal</MenuItem>
              <MenuItem value="direct_deposit">Direct Deposit</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Payments List */}
      {isMobile ? (
        <Box>
          {filteredPayments
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
            .map((payment) => (
              <Card key={payment.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="h6">{payment.crewName}</Typography>
                    <Typography variant="h6" color="error.main">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {moment(payment.paymentDate).format("MMM DD, YYYY")}
                  </Typography>
                  <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip label={payment.paymentMethod} size="small" />
                    {payment.hoursWorked && (
                      <Chip label={`${payment.hoursWorked} hrs`} size="small" color="info" />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Job: {payment.jobName}
                  </Typography>
                  {payment.notes && (
                    <Typography variant="body2" color="text.secondary">
                      {payment.notes}
                    </Typography>
                  )}
                  <Button
                    size="small"
                    startIcon={<ReceiptIcon />}
                    onClick={() => handleViewReceipt(payment)}
                    sx={{ mt: 1 }}
                  >
                    View Receipt
                  </Button>
                </CardContent>
              </Card>
            ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell>Date</TableCell>
                <TableCell>Crew Member</TableCell>
                <TableCell>Job</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPayments
                .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
                .map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{moment(payment.paymentDate).format("MMM DD, YYYY")}</TableCell>
                    <TableCell>{payment.crewName}</TableCell>
                    <TableCell>{payment.jobName}</TableCell>
                    <TableCell>{payment.hoursWorked || "—"}</TableCell>
                    <TableCell>${payment.hourlyRate || "—"}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="error.main">
                        ${parseFloat(payment.amount).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={payment.paymentMethod} size="small" />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<ReceiptIcon />}
                        onClick={() => handleViewReceipt(payment)}
                      >
                        Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}