import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
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
} from "@mui/material";
import Swal from "sweetalert2";
import PersonIcon from "@mui/icons-material/Person";
import PaymentIcon from "@mui/icons-material/Payment";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate } from "react-router-dom";

export default function CrewPayroll() {
  const navigate = useNavigate();
  const [crews, setCrews] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    hoursWorked: "",
    calculatedPay: 0,
    adjustedPay: "",
    paymentDate: new Date().toISOString().split("T")[0],
    payPeriodStart: "",
    payPeriodEnd: "",
    notes: "",
    paymentMethod: "Cash",
  });

  // Edit crew rate dialog
  const [editRateDialogOpen, setEditRateDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState(null);
  const [rateForm, setRateForm] = useState({
    payType: "hourly", // 'hourly' or 'salary'
    hourlyRate: "",
    salaryAmount: "",
    salaryFrequency: "weekly", // 'weekly', 'biweekly', 'monthly'
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

      // Load payment history
      const paymentsSnap = await getDocs(collection(db, "crew_payments"));
      const paymentsData = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPayments(paymentsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
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
      ? new Date(crewPayments[0].paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "Never";
  };

  // Open payment dialog
  const handleOpenPayment = (crew) => {
    setSelectedCrew(crew);
    
    // Pre-calculate based on hourly rate if available
    let calculatedPay = 0;
    if (crew.payType === "salary") {
      calculatedPay = parseFloat(crew.salaryAmount || 0);
    }
    
    setPaymentForm({
      hoursWorked: "",
      calculatedPay: calculatedPay,
      adjustedPay: crew.payType === "salary" ? calculatedPay.toFixed(2) : "",
      paymentDate: new Date().toISOString().split("T")[0],
      payPeriodStart: "",
      payPeriodEnd: "",
      notes: "",
      paymentMethod: "Cash",
    });
    setPaymentDialogOpen(true);
  };

  // Calculate pay when hours change
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
        amount: parseFloat(paymentForm.adjustedPay),
        hoursWorked: parseFloat(paymentForm.hoursWorked) || 0,
        hourlyRate: parseFloat(selectedCrew.hourlyRate) || 0,
        payType: selectedCrew.payType || "hourly",
        paymentDate: paymentForm.paymentDate,
        payPeriodStart: paymentForm.payPeriodStart,
        payPeriodEnd: paymentForm.payPeriodEnd,
        notes: paymentForm.notes,
        paymentMethod: paymentForm.paymentMethod,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "crew_payments"), paymentData);

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
          onClick={() => navigate("/payment-history")}
          size="small"
        >
          Payment History
        </Button>
      </Box>

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
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
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

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Paid
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        ${totalPaid.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Payments
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {crewPayments.length}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Last Paid
                    </Typography>
                    <Typography variant="body2">{lastPaid}</Typography>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<PaymentIcon />}
                    onClick={() => handleOpenPayment(crew)}
                  >
                    Pay {crew.name.split(" ")[0]}
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
      >
        <DialogTitle>
          Pay {selectedCrew?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            {/* Pay Type Info */}
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
            </Alert>

            {/* Hours Worked (only for hourly) */}
            {selectedCrew?.payType !== "salary" && (
              <TextField
                label="Hours Worked"
                type="number"
                value={paymentForm.hoursWorked}
                onChange={(e) => handleHoursChange(e.target.value)}
                inputProps={{ min: 0, step: 0.5 }}
                fullWidth
                helperText={`Rate: $${selectedCrew?.hourlyRate || 0}/hr`}
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
              helperText="You can adjust this amount if needed"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
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

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Pay Period Start"
                  type="date"
                  value={paymentForm.payPeriodStart}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payPeriodStart: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Pay Period End"
                  type="date"
                  value={paymentForm.payPeriodEnd}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payPeriodEnd: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>

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
              label="Notes"
              multiline
              rows={3}
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              placeholder="Bonuses, deductions, or other notes..."
              fullWidth
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
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                  endAdornment: <Typography sx={{ ml: 1 }}>/hr</Typography>,
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
                    startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
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