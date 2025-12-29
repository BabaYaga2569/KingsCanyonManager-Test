import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, query, where } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from "@mui/lab";
import Swal from "sweetalert2";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import moment from "moment";
import generatePaymentReceipt from "./pdf/generatePaymentReceipt";
import { viewPaymentReceiptPDF } from "./utils/pdfViewerUtils";

export default function PaymentTracker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    paymentDate: moment().format("YYYY-MM-DD"),
    reference: "",
    notes: "",
    generateReceipt: true,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load invoice
      const invoiceDoc = await getDoc(doc(db, "invoices", id));
      if (invoiceDoc.exists()) {
        setInvoice({ id: invoiceDoc.id, ...invoiceDoc.data() });
      } else {
        Swal.fire("Not Found", "Invoice not found", "error");
        navigate("/invoices");
        return;
      }

      // Load payments for this invoice
      const paymentsQuery = query(
        collection(db, "payments"),
        where("invoiceId", "==", id)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // Sort by date descending (newest first)
      paymentsData.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      setPayments(paymentsData);

      setLoading(false);
    } catch (error) {
      console.error("Error loading payment data:", error);
      Swal.fire("Error", "Failed to load payment data", "error");
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      Swal.fire("Invalid Amount", "Please enter a valid payment amount", "warning");
      return;
    }

    const paymentAmount = parseFloat(paymentForm.amount);
    const remainingBalance = getRemainingBalance();

    if (paymentAmount > remainingBalance) {
      const result = await Swal.fire({
        title: "Overpayment",
        text: `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)}). Continue?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Record It",
      });
      if (!result.isConfirmed) return;
    }

    try {
      // Create payment record
      const paymentData = {
        invoiceId: id,
        clientName: invoice.clientName,
        amount: paymentAmount,
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        receiptGenerated: paymentForm.generateReceipt,
        createdAt: new Date().toISOString(),
      };

      const paymentRef = await addDoc(collection(db, "payments"), paymentData);

      // Calculate new totals
      const currentTotalPaid = invoice.totalPaid || 0;
      const newTotalPaid = currentTotalPaid + paymentAmount;
      const invoiceTotal = parseFloat(invoice.total || invoice.amount || 0);
      const newRemainingBalance = invoiceTotal - newTotalPaid;

      // Determine payment status
      let paymentStatus = "partial";
      if (newRemainingBalance <= 0) {
        paymentStatus = "paid";
      } else if (newTotalPaid === 0) {
        paymentStatus = "unpaid";
      }

      // Update invoice
      await updateDoc(doc(db, "invoices", id), {
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        paymentStatus: paymentStatus,
        lastPaymentDate: paymentForm.paymentDate,
        status: paymentStatus === "paid" ? "Paid" : invoice.status,
      });

      // Generate receipt if requested
      // Generate and view receipt (mobile-friendly)
      if (paymentForm.generateReceipt) {
        try {
          await viewPaymentReceiptPDF({
            payment: { ...paymentData, id: paymentRef.id },
            invoice: invoice,
            newTotalPaid: newTotalPaid,
            newRemainingBalance: newRemainingBalance,
          }, generatePaymentReceipt);
        } catch (error) {
          console.error("Receipt generation error:", error);
          // Continue even if receipt fails
        }
      }

      Swal.fire({
        icon: "success",
        title: "Payment Recorded!",
        text: `$${paymentAmount.toFixed(2)} payment recorded successfully`,
        timer: 2000,
      });

      setAddPaymentOpen(false);
      setPaymentForm({
        amount: "",
        paymentMethod: "cash",
        paymentDate: moment().format("YYYY-MM-DD"),
        reference: "",
        notes: "",
        generateReceipt: true,
      });

      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
      Swal.fire("Error", "Failed to record payment", "error");
    }
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  };

  const getRemainingBalance = () => {
    const total = parseFloat(invoice?.total || invoice?.amount || 0);
    const paid = getTotalPaid();
    return total - paid;
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

  const getPaymentMethodIcon = (method) => {
    return "💵";
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading payment data...
        </Typography>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Invoice not found</Typography>
      </Container>
    );
  }

  const totalAmount = parseFloat(invoice.total || invoice.amount || 0);
  const totalPaid = getTotalPaid();
  const remainingBalance = getRemainingBalance();
  const percentPaid = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/invoices")}
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Payment Tracker
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddPaymentOpen(true)}
          disabled={remainingBalance <= 0}
        >
          {isMobile ? "Add" : "Add Payment"}
        </Button>
      </Box>

      {/* Invoice Summary Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {invoice.clientName}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Invoice #{id.slice(-8).toUpperCase()}
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Invoice Total
              </Typography>
              <Typography variant="h4" color="primary">
                ${totalAmount.toFixed(2)}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Paid
              </Typography>
              <Typography variant="h4" color="success.main">
                ${totalPaid.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {percentPaid.toFixed(0)}% paid
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Balance Remaining
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: remainingBalance > 0 ? "error.main" : "success.main",
                  fontWeight: 700,
                }}
              >
                ${remainingBalance.toFixed(2)}
              </Typography>
              {remainingBalance <= 0 && (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="PAID IN FULL"
                  color="success"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Payment History */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Payment History ({payments.length})
        </Typography>

        {payments.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No payments recorded yet. Click "Add Payment" to record the first payment.
          </Alert>
        ) : (
          <Timeline position={isMobile ? "right" : "alternate"}>
            {payments.map((payment, index) => (
              <TimelineItem key={payment.id}>
                {!isMobile && (
                  <TimelineOppositeContent color="text.secondary">
                    {moment(payment.paymentDate).format("MMM DD, YYYY")}
                  </TimelineOppositeContent>
                )}
                <TimelineSeparator>
                  <TimelineDot color="success">
                    <PaymentIcon />
                  </TimelineDot>
                  {index < payments.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      {isMobile && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {moment(payment.paymentDate).format("MMM DD, YYYY")}
                        </Typography>
                      )}
                      <Typography variant="h6" color="success.main">
                        ${parseFloat(payment.amount).toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getPaymentMethodIcon(payment.paymentMethod)}{" "}
                        {getPaymentMethodLabel(payment.paymentMethod)}
                      </Typography>
                      {payment.reference && (
                        <Typography variant="body2" color="text.secondary">
                          Ref: {payment.reference}
                        </Typography>
                      )}
                      {payment.notes && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {payment.notes}
                        </Typography>
                      )}
                      {payment.receiptGenerated && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Chip
                            icon={<ReceiptIcon />}
                            label="Receipt Generated"
                            size="small"
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReceiptIcon />}
                            onClick={async () => {
                              try {
                                await viewPaymentReceiptPDF({
                                  payment: payment,
                                  invoice: invoice,
                                  newTotalPaid: invoice.totalPaid || getTotalPaid(),
                                  newRemainingBalance: invoice.remainingBalance || getRemainingBalance(),
                                }, generatePaymentReceipt);
                              } catch (error) {
                                console.error("Error generating receipt:", error);
                                Swal.fire("Error", "Failed to generate receipt", "error");
                              }
                            }}
                          >
                            View Receipt
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Paper>

      {/* Add Payment Dialog */}
      <Dialog
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Alert severity="info">
              Remaining balance: <strong>${remainingBalance.toFixed(2)}</strong>
            </Alert>

            <TextField
              label="Payment Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
              fullWidth
              required
              inputProps={{ min: 0, step: "0.01" }}
              helperText={`Maximum: $${remainingBalance.toFixed(2)}`}
            />

            <TextField
              select
              label="Payment Method"
              value={paymentForm.paymentMethod}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })
              }
              fullWidth
            >
              <MenuItem value="cash">💵 Cash</MenuItem>
              <MenuItem value="check">📝 Check</MenuItem>
              <MenuItem value="zelle">💸 Zelle</MenuItem>
              <MenuItem value="credit_card">💳 Credit Card</MenuItem>
              <MenuItem value="venmo">💰 Venmo</MenuItem>
              <MenuItem value="paypal">🅿️ PayPal</MenuItem>
              <MenuItem value="other">📋 Other</MenuItem>
            </TextField>

            <TextField
              label="Payment Date"
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Reference / Check Number"
              value={paymentForm.reference}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, reference: e.target.value })
              }
              fullWidth
              helperText="Optional: Check number, Zelle confirmation, etc."
            />

            <TextField
              label="Notes"
              multiline
              rows={2}
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
              fullWidth
              helperText="Optional: Deposit, progress payment, final payment, etc."
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={paymentForm.generateReceipt}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      generateReceipt: e.target.checked,
                    })
                  }
                />
              }
              label="Generate payment receipt (PDF)"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddPaymentOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddPayment}
            variant="contained"
            startIcon={<PaymentIcon />}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}