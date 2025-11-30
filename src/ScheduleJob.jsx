import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Grid,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import Swal from "sweetalert2";

export default function ScheduleJob() {
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get("contractId");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    description: "",
    materials: "",
    amount: "",
    contractId: "",
    invoiceId: "",
    jobId: "",
    scheduledDate: "",
    startTime: "09:00",
    duration: 120,
    status: "Scheduled",
    notes: "",
  });

  useEffect(() => {
    if (contractId) {
      loadContractData(contractId);
    }
  }, [contractId]);

  const loadContractData = async (id) => {
    setLoading(true);
    try {
      const contractDoc = await getDoc(doc(db, "contracts", id));
      if (contractDoc.exists()) {
        const contract = contractDoc.data();
        
        // Try to find linked invoice
        let invoiceId = "";
        const invoicesSnap = await collection(db, "invoices");
        const invoiceQuery = await getDoc(invoicesSnap);
        // Simple approach: look for invoice with same jobId
        if (contract.jobId) {
          const allInvoices = await collection(db, "invoices");
          // In real implementation, use a where query
          invoiceId = contract.jobId; // Simplified
        }

        setFormData({
          ...formData,
          customerName: contract.clientName || "",
          customerPhone: contract.clientPhone || "",
          customerAddress: contract.clientAddress || "",
          description: contract.description || "",
          materials: contract.materials || "",
          amount: contract.amount || "",
          contractId: id,
          invoiceId: invoiceId || "",
          jobId: contract.jobId || "",
        });
      }
    } catch (error) {
      console.error("Error loading contract:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName || !formData.scheduledDate || !formData.startTime) {
      Swal.fire("Missing Info", "Please fill in customer name, date, and time.", "warning");
      return;
    }

    try {
      await addDoc(collection(db, "appointments"), {
        ...formData,
        createdAt: new Date().toISOString(),
      });

      Swal.fire({
        icon: "success",
        title: "Job Scheduled!",
        text: `${formData.customerName}'s job is scheduled for ${formData.scheduledDate} at ${formData.startTime}`,
        confirmButtonText: "View Calendar",
      }).then(() => {
        navigate("/calendar");
      });
    } catch (error) {
      console.error("Error scheduling job:", error);
      Swal.fire("Error", "Failed to schedule job. Please try again.", "error");
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading contract data...
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: { xs: 2, sm: 4 }, pb: 4, px: { xs: 2, sm: 3 } }}>
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontSize: { xs: "1.5rem", sm: "2rem" }, mb: 3 }}
        >
          📅 Schedule Job
        </Typography>

        {contractId && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              backgroundColor: "#e3f2fd",
              borderRadius: 2,
              border: "1px solid #1976d2",
            }}
          >
            <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
              ✅ Auto-filled from Contract #{contractId.slice(-8)}
            </Typography>
            <Typography variant="caption">
              Customer info, description, and amount pre-loaded. Just pick date & time!
            </Typography>
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Customer Information */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1, fontSize: "1.1rem" }}>
                Customer Information
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Customer Name"
                name="customerName"
                fullWidth
                required
                value={formData.customerName}
                onChange={handleChange}
                disabled={!!contractId}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                name="customerPhone"
                fullWidth
                value={formData.customerPhone}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Address"
                name="customerAddress"
                fullWidth
                value={formData.customerAddress}
                onChange={handleChange}
                helperText="Full address for GPS navigation"
              />
            </Grid>

            {/* Job Details */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1, fontSize: "1.1rem" }}>
                Job Details
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                name="description"
                multiline
                rows={3}
                fullWidth
                required
                value={formData.description}
                onChange={handleChange}
                disabled={!!contractId}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Materials"
                name="materials"
                multiline
                rows={2}
                fullWidth
                value={formData.materials}
                onChange={handleChange}
                disabled={!!contractId}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Amount"
                name="amount"
                type="number"
                fullWidth
                required
                value={formData.amount}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
                disabled={!!contractId}
              />
            </Grid>

            {/* Schedule Information */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1, fontSize: "1.1rem" }}>
                Schedule ⏰
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Date"
                name="scheduledDate"
                type="date"
                fullWidth
                required
                value={formData.scheduledDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: today }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Start Time"
                name="startTime"
                type="time"
                fullWidth
                required
                value={formData.startTime}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Duration"
                name="duration"
                fullWidth
                value={formData.duration}
                onChange={handleChange}
              >
                <MenuItem value={60}>1 hour</MenuItem>
                <MenuItem value={90}>1.5 hours</MenuItem>
                <MenuItem value={120}>2 hours</MenuItem>
                <MenuItem value={180}>3 hours</MenuItem>
                <MenuItem value={240}>4 hours</MenuItem>
                <MenuItem value={300}>5 hours</MenuItem>
                <MenuItem value={360}>6 hours</MenuItem>
                <MenuItem value={480}>Full day (8 hours)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes (Optional)"
                name="notes"
                multiline
                rows={2}
                fullWidth
                value={formData.notes}
                onChange={handleChange}
                placeholder="Special instructions, parking info, gate code, etc."
              />
            </Grid>

            {/* Submit Buttons */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  fullWidth
                  size="large"
                  sx={{ py: 1.5 }}
                >
                  📅 Schedule Job
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate(-1)}
                  sx={{ minWidth: 100 }}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Preview Card */}
        {formData.customerName && formData.scheduledDate && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              backgroundColor: "#f5f5f5",
              borderRadius: 2,
              border: "1px solid #ddd",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Preview:
            </Typography>
            <Typography variant="body2">
              📅 {formData.scheduledDate} at {formData.startTime}
            </Typography>
            <Typography variant="body2">
              👤 {formData.customerName}
            </Typography>
            <Typography variant="body2">
              ⏱️ {formData.duration} minutes ({(formData.duration / 60).toFixed(1)} hours)
            </Typography>
            <Typography variant="body2">💰 ${formData.amount}</Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}