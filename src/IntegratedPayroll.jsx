import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
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
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Collapse,
} from "@mui/material";
import Swal from "sweetalert2";
import PaymentIcon from "@mui/icons-material/Payment";
import HistoryIcon from "@mui/icons-material/History";
import ReceiptIcon from "@mui/icons-material/Receipt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import moment from "moment";

/**
 * IntegratedPayroll - Connects time tracking → approval → payroll → 1099s
 * 
 * Features:
 * - Shows all approved hours by employee
 * - Groups by week
 * - One-click payment
 * - Marks time as paid
 * - 1099 tracking
 */

export default function IntegratedPayroll() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  // Data
  const [crews, setCrews] = useState([]);
  const [approvedHours, setApprovedHours] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  
  // UI State
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState([]);
  
  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: moment().format("YYYY-MM-DD"),
    paymentMethod: "Cash",
    notes: "",
    paymentType: "hourly", // "hourly" or "flat"
    flatRateAmount: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees from users collection (not crews!)
      const usersSnap = await getDocs(collection(db, "users"));
      const crewsData = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      // Load approved time entries (not yet paid)
      const timeQuery = query(
        collection(db, "job_time_entries"),
        where("status", "==", "approved")
      );
      const timeSnap = await getDocs(timeQuery);
      const timeData = timeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Sort by date
      timeData.sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));
      setApprovedHours(timeData);

      // Load payment history
      const paymentsSnap = await getDocs(collection(db, "crew_payments"));
      const paymentsData = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      paymentsData.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      setPaymentHistory(paymentsData);

      console.log(`Loaded: ${crewsData.length} crews, ${timeData.length} approved hours, ${paymentsData.length} payments`);
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire("Error", "Failed to load payroll data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Group approved hours by employee
  const getEmployeeHours = () => {
    const grouped = {};
    
    approvedHours.forEach(entry => {
      const name = entry.crewName;
      if (!grouped[name]) {
        const crew = crews.find(c => c.name === name);
        grouped[name] = {
          crewName: name,
          crewId: crew?.id,
          hourlyRate: parseFloat(crew?.hourlyRate || 15),
          paymentType: crew?.paymentType || "hourly", // NEW: Get payment type from crew
          is1099: crew?.is1099 !== false, // Default to true for contractors
          entries: [],
          totalHours: 0,
          totalPay: 0,
        };
      }
      
      const hours = parseFloat(entry.hoursWorked || 0);
      grouped[name].entries.push(entry);
      grouped[name].totalHours += hours;
      grouped[name].totalPay += hours * grouped[name].hourlyRate;
    });
    
    // Convert to array and sort by total hours (most first)
    return Object.values(grouped).sort((a, b) => b.totalHours - a.totalHours);
  };

  const employeeHours = getEmployeeHours();

  // Handle payment
  const handleOpenPaymentDialog = (employee) => {
    setSelectedEmployee(employee);
    setSelectedTimeEntries(employee.entries);
    setPaymentForm({
      paymentDate: moment().format("YYYY-MM-DD"),
      paymentMethod: "Cash",
      notes: `Week payment - ${employee.entries.length} time entries`,
      paymentType: employee.paymentType || "hourly", // Use employee's payment type
      flatRateAmount: "",
    });
    setPaymentDialogOpen(true);
  };

  const handlePayEmployee = async () => {
    try {
      if (!selectedEmployee || selectedTimeEntries.length === 0) {
        Swal.fire("Error", "No time entries selected", "error");
        return;
      }

      const totalHours = selectedEmployee.totalHours;
      const hourlyRate = selectedEmployee.hourlyRate;
      
      // Calculate payment based on payment type
      let totalPay;
      if (paymentForm.paymentType === "flat") {
        const flatAmount = parseFloat(paymentForm.flatRateAmount);
        if (!flatAmount || flatAmount <= 0) {
          Swal.fire("Error", "Please enter a valid flat rate amount greater than $0", "error");
          return;
        }
        totalPay = flatAmount;
      } else {
        // Hourly rate
        totalPay = selectedEmployee.totalPay;
      }

      // Get date range
      const dates = selectedTimeEntries.map(e => new Date(e.clockIn));
      const startDate = moment(Math.min(...dates)).format("YYYY-MM-DD");
      const endDate = moment(Math.max(...dates)).format("YYYY-MM-DD");

      // Create payment record
      const paymentData = {
        crewId: selectedEmployee.crewId,
        crewName: selectedEmployee.crewName,
        amount: totalPay,
        hoursWorked: totalHours,
        hourlyRate: hourlyRate, // Always store base hourly rate for reference
        paymentType: paymentForm.paymentType, // NEW: Store payment type
        flatRateAmount: paymentForm.paymentType === "flat" ? totalPay : null, // NEW: Store flat rate if applicable
        payPeriodStart: startDate,
        payPeriodEnd: endDate,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        notes: paymentForm.notes,
        timeEntryIds: selectedTimeEntries.map(e => e.id),
        is1099: selectedEmployee.is1099,
        taxYear: moment(paymentForm.paymentDate).year(),
        createdAt: new Date().toISOString(),
      };

      const paymentRef = await addDoc(collection(db, "crew_payments"), paymentData);
      console.log("✅ Payment created:", paymentRef.id);

      // Mark time entries as paid
      for (const entry of selectedTimeEntries) {
        await updateDoc(doc(db, "job_time_entries", entry.id), {
          status: "paid",
          paidAt: new Date().toISOString(),
          paymentId: paymentRef.id,
        });
      }
      console.log(`✅ Marked ${selectedTimeEntries.length} time entries as paid`);

      // Success message based on payment type
      const paymentDetails = paymentForm.paymentType === "flat"
        ? `Flat Rate: <strong>$${totalPay.toFixed(2)}</strong>`
        : `${totalHours} hours × $${hourlyRate}/hr = <strong>$${totalPay.toFixed(2)}</strong>`;

      Swal.fire({
        icon: "success",
        title: "Payment Created!",
        html: `
          <p><strong>${selectedEmployee.crewName}</strong></p>
          <p>${paymentDetails}</p>
          <p>Payment recorded for ${paymentForm.paymentMethod}</p>
        `,
        timer: 3000,
      });

      // Reload data
      setPaymentDialogOpen(false);
      loadData();
      
    } catch (error) {
      console.error("Error creating payment:", error);
      Swal.fire("Error", "Failed to create payment: " + error.message, "error");
    }
  };

  // Calculate stats
  const totalUnpaidHours = approvedHours.reduce((sum, e) => sum + parseFloat(e.hoursWorked || 0), 0);
  const totalUnpaidAmount = employeeHours.reduce((sum, emp) => sum + emp.totalPay, 0);
  const totalPaymentsYTD = paymentHistory
    .filter(p => moment(p.paymentDate).year() === moment().year())
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          💼 Integrated Payroll
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ReceiptIcon />}
          onClick={() => setActiveTab(2)}
        >
          Tax Reports
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "warning.light" }}>
            <CardContent>
              <Typography variant="h6">Unpaid Hours</Typography>
              <Typography variant="h4" fontWeight="bold">
                {totalUnpaidHours.toFixed(1)}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {approvedHours.length} approved time entries
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "error.light" }}>
            <CardContent>
              <Typography variant="h6">Unpaid Amount</Typography>
              <Typography variant="h4" fontWeight="bold">
                ${totalUnpaidAmount.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {employeeHours.length} employees awaiting payment
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "success.light" }}>
            <CardContent>
              <Typography variant="h6">Paid YTD ({moment().year()})</Typography>
              <Typography variant="h4" fontWeight="bold">
                ${totalPaymentsYTD.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {paymentHistory.filter(p => moment(p.paymentDate).year() === moment().year()).length} payments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Approved Hours (Unpaid)" />
          <Tab label="Payment History" />
          <Tab label="Tax Reports" />
        </Tabs>
      </Paper>

      {/* Tab 1: Approved Hours */}
      {activeTab === 0 && (
        <Box>
          {employeeHours.length === 0 && (
            <Alert severity="info">
              No approved hours awaiting payment. All caught up! 🎉
            </Alert>
          )}

          {employeeHours.map((employee) => (
            <Card key={employee.crewName} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {employee.crewName}
                    </Typography>
                    {employee.is1099 && (
                      <Chip label="1099" size="small" color="primary" />
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="h6" fontWeight="bold">
                        {employee.totalHours.toFixed(1)}h × ${employee.hourlyRate}/hr
                      </Typography>
                      <Typography variant="h5" color="success.main" fontWeight="bold">
                        ${employee.totalPay.toFixed(2)}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={() => setExpandedEmployee(
                        expandedEmployee === employee.crewName ? null : employee.crewName
                      )}
                    >
                      {expandedEmployee === employee.crewName ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={expandedEmployee === employee.crewName}>
                  <Divider sx={{ mb: 2 }} />
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Clock In</strong></TableCell>
                        <TableCell><strong>Clock Out</strong></TableCell>
                        <TableCell><strong>Hours</strong></TableCell>
                        <TableCell><strong>Job Description</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {employee.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{moment(entry.clockIn).format("MMM D, YYYY")}</TableCell>
                          <TableCell>{moment(entry.clockIn).format("h:mm A")}</TableCell>
                          <TableCell>{moment(entry.clockOut).format("h:mm A")}</TableCell>
                          <TableCell><strong>{entry.hoursWorked}h</strong></TableCell>
                          <TableCell>{entry.jobDescription || "No description"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Collapse>

                <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<PaymentIcon />}
                    onClick={() => handleOpenPaymentDialog(employee)}
                  >
                    Pay {employee.crewName} - ${employee.totalPay.toFixed(2)}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Tab 2: Payment History */}
      {activeTab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Payment History
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Employee</strong></TableCell>
                <TableCell><strong>Hours</strong></TableCell>
                <TableCell><strong>Rate</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Method</strong></TableCell>
                <TableCell><strong>Period</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentHistory.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{moment(payment.paymentDate).format("MMM D, YYYY")}</TableCell>
                  <TableCell>
                    {payment.crewName}
                    {payment.is1099 && <Chip label="1099" size="small" color="primary" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{payment.hoursWorked}h</TableCell>
                  <TableCell>${payment.hourlyRate || "N/A"}/hr</TableCell>
                  <TableCell><strong>${parseFloat(payment.amount || 0).toFixed(2)}</strong></TableCell>
                  <TableCell>{payment.paymentMethod}</TableCell>
                  <TableCell>
                    {payment.payPeriodStart && payment.payPeriodEnd
                      ? `${moment(payment.payPeriodStart).format("MMM D")} - ${moment(payment.payPeriodEnd).format("MMM D")}`
                      : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Tab 3: Tax Reports */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            📊 Tax Reports - {moment().year()}
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            1099 contractors only. Manager/family payments not included.
          </Alert>

          {crews
            .filter(crew => crew.is1099 !== false)
            .map(crew => {
              const payments1099 = paymentHistory.filter(
                p => p.crewName === crew.name && 
                     p.is1099 !== false && 
                     moment(p.paymentDate).year() === moment().year()
              );
              const total = payments1099.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              
              if (payments1099.length === 0) return null;
              
              return (
                <Card key={crew.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {crew.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {payments1099.length} payments in {moment().year()}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" color="text.secondary">
                          Total {moment().year()} (1099-NEC)
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color="primary.main">
                          ${total.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}

          <Divider sx={{ my: 3 }} />
          
          <Typography variant="body2" color="text.secondary">
            💡 At year end, use this data to generate 1099-NEC forms for all contractors who earned $600+
          </Typography>
        </Paper>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: "success.main", color: "white" }}>
          💰 Pay {selectedEmployee?.crewName}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Payment Summary:</strong>
            <br />
            {paymentForm.paymentType === "hourly" ? (
              <>
                {selectedEmployee?.totalHours.toFixed(1)} hours × ${selectedEmployee?.hourlyRate}/hr = ${selectedEmployee?.totalPay.toFixed(2)}
              </>
            ) : (
              <>
                Flat Rate Payment
              </>
            )}
            <br />
            {selectedTimeEntries.length} time entries will be marked as "paid"
          </Alert>
          
          <TextField
            label="Payment Type"
            select
            value={paymentForm.paymentType}
            onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
            SelectProps={{ native: true }}
          >
            <option value="hourly">Hourly Rate</option>
            <option value="flat">Flat Rate</option>
          </TextField>
          
          {paymentForm.paymentType === "flat" && (
            <TextField
              label="Flat Rate Amount"
              type="number"
              value={paymentForm.flatRateAmount}
              onChange={(e) => setPaymentForm({ ...paymentForm, flatRateAmount: e.target.value })}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              placeholder="Enter flat amount (e.g., 200)"
              helperText={`${selectedEmployee?.totalHours.toFixed(1)} hours of work completed`}
            />
          )}

          <TextField
            label="Payment Date"
            type="date"
            value={paymentForm.paymentDate}
            onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Payment Method"
            select
            value={paymentForm.paymentMethod}
            onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
            SelectProps={{ native: true }}
          >
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
            <option value="Zelle">Zelle</option>
            <option value="Other">Other</option>
          </TextField>

          <TextField
            label="Notes (Optional)"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handlePayEmployee}>
            {paymentForm.paymentType === "flat" 
              ? `Create Payment - $${paymentForm.flatRateAmount || "0.00"}`
              : `Create Payment - $${selectedEmployee?.totalPay.toFixed(2) || "0.00"}`
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
