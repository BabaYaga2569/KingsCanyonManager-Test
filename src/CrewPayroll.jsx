import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  Alert,
  Paper,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  useMediaQuery,
  useTheme,
  Stack,
} from "@mui/material";
import Swal from "sweetalert2";
import PersonIcon from "@mui/icons-material/Person";
import PaymentIcon from "@mui/icons-material/Payment";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import moment from "moment";
import generateCrewPaymentReceipt from "./pdf/generateCrewPaymentReceipt";

export default function CrewPayroll() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  
  const [crews, setCrews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Week selection
  const [weekStart, setWeekStart] = useState(moment().startOf('week'));
  const [weekEnd, setWeekEnd] = useState(moment().endOf('week'));
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    jobId: "",
    jobName: "",
    hoursWorked: "",
    calculatedPay: 0,
    adjustedPay: "",
    paymentDate: moment().format("YYYY-MM-DD"),
    payPeriodStart: "",
    payPeriodEnd: "",
    notes: "",
    paymentMethod: "Cash",
    reference: "",
    generateReceipt: true,
  });

  // Edit crew rate dialog
  const [editRateDialogOpen, setEditRateDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState(null);
  const [rateForm, setRateForm] = useState({
    payType: "hourly",
    hourlyRate: "",
    salaryAmount: "",
    salaryFrequency: "weekly",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load crews
      const crewsSnap = await getDocs(collection(db, "crews"));
      const crewsData = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      // Load jobs
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setJobs(jobsData);

      // Load payment history
      const paymentsSnap = await getDocs(collection(db, "crew_payments"));
      const paymentsData = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPayments(paymentsData);

      // Load time entries from Job Time Tracking
      const timeSnap = await getDocs(collection(db, "job_time_entries"));
      const timeData = timeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTimeEntries(timeData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get time entries for a crew member in the selected week
  const getCrewWeeklyHours = (crewId) => {
    const weekStartStr = weekStart.format('YYYY-MM-DD');
    const weekEndStr = weekEnd.format('YYYY-MM-DD');
    
    const crewEntries = timeEntries.filter(entry => {
      if (entry.crewId !== crewId) return false;
      const entryDate = moment(entry.workDate);
      return entryDate.isBetween(weekStartStr, weekEndStr, 'day', '[]');
    });

    const totalHours = crewEntries.reduce((sum, entry) => sum + (parseFloat(entry.hoursWorked) || 0), 0);
    return totalHours;
  };

  // Get payments for a crew member in the selected week
  const getCrewWeeklyPayments = (crewId) => {
    const weekStartStr = weekStart.format('YYYY-MM-DD');
    const weekEndStr = weekEnd.format('YYYY-MM-DD');
    
    const crewPayments = payments.filter(payment => {
      if (payment.crewId !== crewId) return false;
      const paymentDate = moment(payment.paymentDate);
      return paymentDate.isBetween(weekStartStr, weekEndStr, 'day', '[]');
    });

    const totalPaid = crewPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    return { payments: crewPayments, totalPaid };
  };

  // Calculate amount owed based on weekly hours
  const getCrewAmountOwed = (crew) => {
    const weeklyHours = getCrewWeeklyHours(crew.id);
    const { totalPaid } = getCrewWeeklyPayments(crew.id);
    
    let calculatedAmount = 0;
    if (crew.payType === 'salary') {
      calculatedAmount = parseFloat(crew.salaryAmount) || 0;
    } else {
      const rate = parseFloat(crew.hourlyRate) || 0;
      calculatedAmount = weeklyHours * rate;
    }
    
    const owed = calculatedAmount - totalPaid;
    return { calculatedAmount, owed, weeklyHours };
  };

  // Navigate to different week
  const handlePreviousWeek = () => {
    setWeekStart(weekStart.clone().subtract(1, 'week'));
    setWeekEnd(weekEnd.clone().subtract(1, 'week'));
  };

  const handleNextWeek = () => {
    setWeekStart(weekStart.clone().add(1, 'week'));
    setWeekEnd(weekEnd.clone().add(1, 'week'));
  };

  const handleThisWeek = () => {
    setWeekStart(moment().startOf('week'));
    setWeekEnd(moment().endOf('week'));
  };

  // Calculate totals
  const totalPayroll = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalCrewMembers = crews.length;
  const totalPayments = payments.length;

  // Get crew payment history
  const getCrewPayments = (crewId) => {
    return payments.filter((p) => p.crewId === crewId);
  };

  const getCrewTotalPaid = (crewId) => {
    return getCrewPayments(crewId).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  const getLastPaid = (crewId) => {
    const crewPayments = getCrewPayments(crewId).sort((a, b) => 
      new Date(b.paymentDate) - new Date(a.paymentDate)
    );
    return crewPayments.length > 0 
      ? moment(crewPayments[0].paymentDate).format("MMM DD")
      : "Never";
  };

  // Open payment dialog with auto-calculated weekly amount
  const handleOpenPayment = (crew) => {
    setSelectedCrew(crew);
    
    const { calculatedAmount, weeklyHours } = getCrewAmountOwed(crew);
    
    // Auto-fill based on weekly hours
    const weekStartStr = weekStart.format("YYYY-MM-DD");
    const weekEndStr = weekEnd.format("YYYY-MM-DD");
    
    setPaymentForm({
      jobId: "",
      jobName: "",
      hoursWorked: crew.payType === 'hourly' ? weeklyHours.toFixed(2) : "",
      calculatedPay: calculatedAmount,
      adjustedPay: calculatedAmount.toFixed(2),
      paymentDate: moment().format("YYYY-MM-DD"),
      payPeriodStart: weekStartStr,
      payPeriodEnd: weekEndStr,
      notes: "",
      paymentMethod: "Cash",
      reference: "",
      generateReceipt: true,
    });
    setPaymentDialogOpen(true);
  };

  // Calculate pay when hours change (manual override)
  const handleHoursChange = (hours) => {
    const hoursNum = parseFloat(hours) || 0;
    const rate = parseFloat(selectedCrew?.hourlyRate || 0);
    const calculated = hoursNum * rate;
    
    setPaymentForm({
      ...paymentForm,
      hoursWorked: hours,
      calculatedPay: calculated,
      adjustedPay: calculated.toFixed(2),
    });
  };

  // Submit payment
  const handleSubmitPayment = async () => {
    if (!paymentForm.adjustedPay || parseFloat(paymentForm.adjustedPay) <= 0) {
      Swal.fire("Invalid Amount", "Please enter a valid payment amount", "warning");
      return;
    }

    try {
      const paymentData = {
        crewId: selectedCrew.id,
        crewName: selectedCrew.name,
        jobId: paymentForm.jobId || null,
        jobName: paymentForm.jobName || "General Work",
        amount: parseFloat(paymentForm.adjustedPay),
        hoursWorked: parseFloat(paymentForm.hoursWorked) || 0,
        hourlyRate: parseFloat(selectedCrew.hourlyRate) || 0,
        payType: selectedCrew.payType || "hourly",
        paymentDate: paymentForm.paymentDate,
        payPeriodStart: paymentForm.payPeriodStart,
        payPeriodEnd: paymentForm.payPeriodEnd,
        notes: paymentForm.notes,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference,
        receiptGenerated: paymentForm.generateReceipt,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "crew_payments"), paymentData);

      // Update job with labor cost if job is linked
      if (paymentForm.jobId) {
        const jobRef = doc(db, "jobs", paymentForm.jobId);
        const job = jobs.find((j) => j.id === paymentForm.jobId);
        const currentLaborCost = parseFloat(job?.laborCost || 0);
        await updateDoc(jobRef, {
          laborCost: currentLaborCost + parseFloat(paymentForm.adjustedPay),
        });
      }

      // Generate PDF receipt if requested
      if (paymentForm.generateReceipt) {
        try {
          const receipt = await generateCrewPaymentReceipt({
            ...paymentData,
            crewName: selectedCrew.name,
            companyName: "Kings Canyon Landscaping LLC",
            companyPhone: "(928) 450-5733",
          });
          receipt.save(`Receipt_${selectedCrew.name.replace(/\s+/g, "_")}_${moment().format("YYYYMMDD")}.pdf`);
        } catch (error) {
          console.error("Error generating receipt:", error);
        }
      }

      Swal.fire({
        icon: "success",
        title: "Payment Recorded!",
        text: `$${paymentForm.adjustedPay} paid to ${selectedCrew.name}`,
        timer: 2000,
        showConfirmButton: false,
      });

      setPaymentDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
      Swal.fire("Error", "Failed to record payment", "error");
    }
  };

  // Edit crew pay rate
  const handleOpenEditRate = (crew) => {
    setEditingCrew(crew);
    setRateForm({
      payType: crew.payType || "hourly",
      hourlyRate: crew.hourlyRate || "",
      salaryAmount: crew.salaryAmount || "",
      salaryFrequency: crew.salaryFrequency || "weekly",
    });
    setEditRateDialogOpen(true);
  };

  const handleSaveRate = async () => {
    try {
      await updateDoc(doc(db, "crews", editingCrew.id), {
        payType: rateForm.payType,
        hourlyRate: rateForm.payType === "hourly" ? parseFloat(rateForm.hourlyRate) || 0 : 0,
        salaryAmount: rateForm.payType === "salary" ? parseFloat(rateForm.salaryAmount) || 0 : 0,
        salaryFrequency: rateForm.payType === "salary" ? rateForm.salaryFrequency : "",
      });

      Swal.fire("Updated!", "Pay rate updated successfully", "success");
      setEditRateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error updating rate:", error);
      Swal.fire("Error", "Failed to update pay rate", "error");
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <Typography>Loading payroll...</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 3, mb: 6, px: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
            👷 Crew Payroll
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => navigate("/crew-payment-history")}
          size="small"
        >
          {isMobile ? "History" : "Payment History"}
        </Button>
      </Box>

      {/* Week Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Pay Period
            </Typography>
            <Typography variant="body1" color="primary.main" sx={{ fontWeight: 600 }}>
              {weekStart.format("MMM D")} - {weekEnd.format("MMM D, YYYY")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={handlePreviousWeek}>
              ← Prev Week
            </Button>
            <Button variant="contained" size="small" onClick={handleThisWeek}>
              This Week
            </Button>
            <Button variant="outlined" size="small" onClick={handleNextWeek}>
              Next Week →
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Payroll Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Payroll Summary
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Payroll (All Time)
              </Typography>
              <Typography variant="h4" color="error.main" sx={{ fontWeight: 700 }}>
                ${totalPayroll.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Crew Members
              </Typography>
              <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700 }}>
                {totalCrewMembers}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Payments
              </Typography>
              <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700 }}>
                {totalPayments}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Crew Cards */}
      <Grid container spacing={2}>
        {crews.map((crew) => {
          const crewPayments = getCrewPayments(crew.id);
          const totalPaid = getCrewTotalPaid(crew.id);
          const lastPaid = getLastPaid(crew.id);
          
          // NEW: Weekly tracking
          const { calculatedAmount, owed, weeklyHours } = getCrewAmountOwed(crew);
          const { totalPaid: weeklyPaid } = getCrewWeeklyPayments(crew.id);

          return (
            <Grid item xs={12} sm={6} md={4} key={crew.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonIcon color="primary" />
                      <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                        {crew.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={crew.isAvailable ? "Available" : "Busy"}
                      color={crew.isAvailable ? "success" : "warning"}
                      size="small"
                    />
                  </Box>

                  {crew.role && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {crew.role}
                    </Typography>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Pay Rate Display with Edit Button */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {crew.payType === "salary" ? "Salary" : "Hourly Rate"}
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {crew.payType === "salary" 
                          ? `$${crew.salaryAmount || 0}/${crew.salaryFrequency || "week"}`
                          : `$${crew.hourlyRate || 0}/hr`
                        }
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenEditRate(crew)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* NEW: This Week Stats */}
                  <Paper sx={{ p: 1.5, mb: 2, bgcolor: "#f5f5f5" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      THIS WEEK ({weekStart.format("MMM D")} - {weekEnd.format("MMM D")})
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mt: 1 }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <AccessTimeIcon sx={{ fontSize: 16, color: "primary.main" }} />
                          <Typography variant="caption" color="text.secondary">
                            Hours Logged
                          </Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.main" }}>
                          {weeklyHours.toFixed(1)}h
                        </Typography>
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <AttachMoneyIcon sx={{ fontSize: 16, color: owed > 0 ? "success.main" : "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            Amount Owed
                          </Typography>
                        </Box>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600, 
                            color: owed > 0 ? "success.main" : "text.secondary" 
                          }}
                        >
                          ${owed.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                    {weeklyPaid > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="success.main">
                          ✓ Paid ${weeklyPaid.toFixed(2)} this week
                        </Typography>
                      </Box>
                    )}
                  </Paper>

                  {/* All-Time Stats */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Paid (All Time)
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        ${totalPaid.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Last Paid
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {lastPaid}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<PaymentIcon />}
                    onClick={() => handleOpenPayment(crew)}
                    color={owed > 0 ? "success" : "primary"}
                  >
                    {owed > 0 ? `Pay $${owed.toFixed(2)}` : `Pay ${crew.name.split(" ")[0]}`}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {crews.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No crew members found. Add crew members in the Crew Manager to get started.
        </Alert>
      )}

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Pay {selectedCrew?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            {/* Pay Type Info + Weekly Summary */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Pay Type:</strong> {selectedCrew?.payType === "salary" ? "Salary" : "Hourly"}
              </Typography>
              <Typography variant="body2">
                <strong>Rate:</strong> {
                  selectedCrew?.payType === "salary"
                    ? `$${selectedCrew?.salaryAmount || 0}/${selectedCrew?.salaryFrequency || "week"}`
                    : `$${selectedCrew?.hourlyRate || 0}/hr`
                }
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Week:</strong> {weekStart.format("MMM D")} - {weekEnd.format("MMM D")}
              </Typography>
              <Typography variant="body2">
                <strong>Hours Logged:</strong> {paymentForm.hoursWorked || 0}h
              </Typography>
            </Alert>

            {/* Link to Job */}
            <TextField
              select
              label="Link to Job (Optional)"
              value={paymentForm.jobId}
              onChange={(e) => {
                const job = jobs.find((j) => j.id === e.target.value);
                setPaymentForm({
                  ...paymentForm,
                  jobId: e.target.value,
                  jobName: job ? job.clientName : "General Work",
                });
              }}
              fullWidth
              helperText="Link payment to a specific job for labor cost tracking"
            >
              <MenuItem value="">General Work</MenuItem>
              {jobs.map((job) => (
                <MenuItem key={job.id} value={job.id}>
                  {job.clientName}
                </MenuItem>
              ))}
            </TextField>

            {/* Hours Worked (only for hourly, with auto-filled value) */}
            {selectedCrew?.payType !== "salary" && (
              <TextField
                label="Hours Worked"
                type="number"
                value={paymentForm.hoursWorked}
                onChange={(e) => handleHoursChange(e.target.value)}
                inputProps={{ min: 0, step: 0.5 }}
                fullWidth
                helperText={`Auto-filled from this week's time entries. Rate: $${selectedCrew?.hourlyRate || 0}/hr`}
              />
            )}

            {/* Calculated Pay */}
            {selectedCrew?.payType !== "salary" && paymentForm.calculatedPay > 0 && (
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Calculated Pay:</strong> ${paymentForm.calculatedPay.toFixed(2)}
                </Typography>
                <Typography variant="caption">
                  {paymentForm.hoursWorked} hours × ${selectedCrew?.hourlyRate || 0}/hr
                </Typography>
              </Alert>
            )}

            {/* Adjusted Pay Amount */}
            <TextField
              label="Payment Amount *"
              type="number"
              value={paymentForm.adjustedPay}
              onChange={(e) => setPaymentForm({ ...paymentForm, adjustedPay: e.target.value })}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              required
              helperText="Auto-filled based on weekly hours. You can adjust if needed."
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />

            <Divider />

            {/* Payment Details */}
            <TextField
              label="Payment Date *"
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField
                label="Pay Period Start"
                type="date"
                value={paymentForm.payPeriodStart}
                onChange={(e) => setPaymentForm({ ...paymentForm, payPeriodStart: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
                helperText="Auto-filled"
              />
              <TextField
                label="Pay Period End"
                type="date"
                value={paymentForm.payPeriodEnd}
                onChange={(e) => setPaymentForm({ ...paymentForm, payPeriodEnd: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
                helperText="Auto-filled"
              />
            </Box>

            <TextField
              select
              label="Payment Method"
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              fullWidth
            >
              <MenuItem value="Cash">Cash</MenuItem>
              <MenuItem value="Check">Check</MenuItem>
              <MenuItem value="Zelle">Zelle</MenuItem>
              <MenuItem value="Venmo">Venmo</MenuItem>
              <MenuItem value="Direct Deposit">Direct Deposit</MenuItem>
            </TextField>

            <TextField
              label="Reference / Check #"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              placeholder="Check number, transaction ID, etc."
              fullWidth
            />

            <TextField
              label="Notes"
              multiline
              rows={3}
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              placeholder="Bonuses, deductions, or other notes..."
              fullWidth
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={paymentForm.generateReceipt}
                  onChange={(e) => setPaymentForm({ ...paymentForm, generateReceipt: e.target.checked })}
                />
              }
              label="Generate PDF Receipt"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitPayment}
            disabled={!paymentForm.adjustedPay || parseFloat(paymentForm.adjustedPay) <= 0}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Pay Rate Dialog */}
      <Dialog
        open={editRateDialogOpen}
        onClose={() => setEditRateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Pay Rate - {editingCrew?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              select
              label="Pay Type *"
              value={rateForm.payType}
              onChange={(e) => setRateForm({ ...rateForm, payType: e.target.value })}
              fullWidth
              required
            >
              <MenuItem value="hourly">Hourly</MenuItem>
              <MenuItem value="salary">Salary</MenuItem>
            </TextField>

            {rateForm.payType === "hourly" && (
              <TextField
                label="Hourly Rate *"
                type="number"
                value={rateForm.hourlyRate}
                onChange={(e) => setRateForm({ ...rateForm, hourlyRate: e.target.value })}
                inputProps={{ min: 0, step: 0.25 }}
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/hr</InputAdornment>,
                }}
              />
            )}

            {rateForm.payType === "salary" && (
              <>
                <TextField
                  label="Salary Amount *"
                  type="number"
                  value={rateForm.salaryAmount}
                  onChange={(e) => setRateForm({ ...rateForm, salaryAmount: e.target.value })}
                  inputProps={{ min: 0, step: 100 }}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />

                <TextField
                  select
                  label="Salary Frequency *"
                  value={rateForm.salaryFrequency}
                  onChange={(e) => setRateForm({ ...rateForm, salaryFrequency: e.target.value })}
                  fullWidth
                  required
                >
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="biweekly">Bi-weekly (Every 2 weeks)</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </TextField>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditRateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRate}>
            Save Rate
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}