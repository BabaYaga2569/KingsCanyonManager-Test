import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
} from "@mui/material";
import QRCode from "qrcode";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import Swal from "sweetalert2";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
  zellePhone: "9284505733", // No dashes for Zelle URL
  logoPath: "/logo-kcl.png",
};

export default function PaymentPortal() {
  const { invoiceId } = useParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      const docRef = doc(db, "invoices", invoiceId);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        Swal.fire("Not Found", "This payment link is invalid or expired.", "error");
        setLoading(false);
        return;
      }

      const data = snap.data();
      setInvoice({ id: snap.id, ...data });

      // Load existing payments
      const paymentsSnap = await getDocs(collection(db, "invoices", invoiceId, "payments"));
      const paymentsData = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPayments(paymentsData);

      // Generate QR code for remaining balance
      const totalPaid = paymentsData.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const remaining = (data.total || data.amount || 0) - totalPaid;
      
      if (remaining > 0) {
        await generateQRCode(remaining, data);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading invoice:", error);
      Swal.fire("Error", "Failed to load payment information.", "error");
      setLoading(false);
    }
  };

  const generateQRCode = async (amount, invoiceData) => {
    try {
      // Zelle URL format
      const zelleURL = `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(JSON.stringify({
        token: COMPANY.zellePhone,
        amount: amount.toFixed(2),
        note: `Invoice ${invoiceId.slice(-8)}`,
      }))}`;

      const qrUrl = await QRCode.toDataURL(zelleURL, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleMarkAsPaid = async (paymentMethod) => {
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const remaining = (invoice.total || invoice.amount || 0) - totalPaid;

    const result = await Swal.fire({
      title: "Confirm Payment",
      html: `
        <p>I have sent <strong>$${remaining.toFixed(2)}</strong> via ${paymentMethod}</p>
        <p style="font-size: 0.9em; color: #666;">
          Note: The business owner will verify this payment before marking your invoice as paid.
        </p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm Payment Sent",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      Swal.fire({
        icon: "success",
        title: "Payment Confirmation Sent!",
        html: `
          <p>Thank you! We've notified ${COMPANY.name}</p>
          <p>You'll receive a confirmation once payment is verified.</p>
          <p>Questions? Call ${COMPANY.phone}</p>
        `,
      });
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading payment information...
        </Typography>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Payment Link Invalid</Typography>
          <Typography>This payment link is invalid or has expired.</Typography>
        </Alert>
      </Container>
    );
  }

  const totalAmount = invoice.total || invoice.amount || 0;
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const remainingBalance = totalAmount - totalPaid;
  const isPaidInFull = remainingBalance <= 0;

  // Determine if this is deposit or final payment
  const isDepositPayment = totalPaid === 0;
  const depositAmount = invoice.depositAmount || (totalAmount * 0.5);
  const currentPaymentAmount = isDepositPayment ? depositAmount : remainingBalance;

  if (isPaidInFull) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Invoice Paid in Full!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Total Paid: <strong>${totalPaid.toFixed(2)}</strong>
          </Typography>
          <Typography variant="body2">
            Thank you for your payment!<br />
            {COMPANY.name}<br />
            {COMPANY.phone}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      {/* Header */}
      <Paper sx={{ p: { xs: 2, sm: 4 }, mb: 3 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <img 
            src={COMPANY.logoPath} 
            alt="Kings Canyon Landscaping" 
            style={{ height: 60, marginBottom: 16 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <Typography variant="h4" gutterBottom>
            Payment Portal
          </Typography>
          <Typography variant="h6" color="primary">
            {COMPANY.name}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Invoice Summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invoice for: {invoice.clientName}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: "center", bgcolor: "grey.100" }}>
                <Typography variant="caption" color="text.secondary">
                  Total Invoice
                </Typography>
                <Typography variant="h5">
                  ${totalAmount.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: "center", bgcolor: "success.light" }}>
                <Typography variant="caption">
                  Paid
                </Typography>
                <Typography variant="h5" sx={{ color: "success.dark" }}>
                  ${totalPaid.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: "center", bgcolor: "error.light" }}>
                <Typography variant="caption">
                  Amount Due
                </Typography>
                <Typography variant="h5" sx={{ color: "error.dark" }}>
                  ${remainingBalance.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {isDepositPayment && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>Deposit Payment (50%):</strong> ${depositAmount.toFixed(2)}<br />
              Final payment of ${(totalAmount - depositAmount).toFixed(2)} will be due upon completion.
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Payment Methods */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Choose Payment Method
      </Typography>

      <Grid container spacing={3}>
        {/* Zelle Payment */}
        <Grid item xs={12}>
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <PaymentIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
                <Box>
                  <Typography variant="h5">
                    Pay with Zelle
                  </Typography>
                  <Chip label="FREE - No Fees!" color="success" size="small" sx={{ mt: 0.5 }} />
                </Box>
              </Box>

              <Alert severity="success" sx={{ mb: 3 }}>
                <strong>Recommended:</strong> Instant, free, and secure payment via Zelle
              </Alert>

              <Box sx={{ textAlign: "center", mb: 3 }}>
                {qrCodeUrl && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>
                      Scan QR Code with Your Camera:
                    </Typography>
                    <Paper sx={{ display: "inline-block", p: 2, my: 2 }}>
                      <img src={qrCodeUrl} alt="Zelle QR Code" style={{ width: 250, height: 250 }} />
                    </Paper>
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 2 }}>
                <Typography variant="caption">OR</Typography>
              </Divider>

              <Box sx={{ bgcolor: "grey.100", p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Send Manually via Zelle:</strong>
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Phone:</strong> {COMPANY.phone}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Amount:</strong> ${currentPaymentAmount.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  <strong>Note:</strong> Invoice {invoiceId.slice(-8)}
                </Typography>
              </Box>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => handleMarkAsPaid("Zelle")}
                sx={{ mt: 3 }}
              >
                I've Sent Payment via Zelle
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Cash/Check Option */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💵 Pay with Cash or Check
              </Typography>
              <Typography variant="body2" paragraph>
                Prefer to pay in person? Call us to arrange payment:
              </Typography>
              <Typography variant="h5" color="primary" gutterBottom>
                {COMPANY.phone}
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                href={`tel:${COMPANY.phone.replace(/\D/g, '')}`}
                sx={{ mt: 2 }}
              >
                Call to Arrange Payment
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment History */}
      {payments.length > 0 && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Payment History
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {payments.map((payment, index) => (
            <Box key={payment.id} sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="body1">
                    <strong>${parseFloat(payment.amount || 0).toFixed(2)}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {payment.paymentMethod} - {new Date(payment.paymentDate).toLocaleDateString()}
                  </Typography>
                </Box>
                <Chip label="Paid" color="success" size="small" />
              </Box>
              {index < payments.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Paper>
      )}

      {/* Footer */}
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Questions? Contact us at {COMPANY.phone} or {COMPANY.email}
        </Typography>
      </Box>
    </Container>
  );
}