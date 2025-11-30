import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  Paper,
} from "@mui/material";
import Swal from "sweetalert2";

export default function BidEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bid, setBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchBid = async () => {
      try {
        const docRef = doc(db, "bids", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setBid({ id: snap.id, ...snap.data() });
        } else {
          Swal.fire("Not found", "Bid not found.", "error");
          navigate("/bids");
        }
      } catch (e) {
        console.error("Error loading bid:", e);
        Swal.fire("Error", "Failed to load bid.", "error");
        navigate("/bids");
      } finally {
        setLoading(false);
      }
    };
    fetchBid();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBid({ ...bid, [name]: value });
  };

  const handleSave = async () => {
    if (!bid.customerName || !bid.amount) {
      Swal.fire("Missing info", "Customer name and amount are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "bids", id);
      await updateDoc(docRef, {
        customerName: bid.customerName,
        amount: parseFloat(bid.amount),
        description: bid.description || "",
        materials: bid.materials || "",
        notes: bid.notes || "",
        updatedAt: new Date().toISOString(),
      });
      
      await Swal.fire("Saved", "Bid updated successfully.", "success");
      navigate("/bids");
    } catch (e) {
      console.error("Error saving bid:", e);
      Swal.fire("Error", "Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading bid...
        </Typography>
      </Container>
    );
  }

  if (!bid) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">No bid data available.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: { xs: 2, sm: 4 }, pb: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, sm: 3 },
          borderRadius: 2
        }}
      >
        <Typography 
          variant="h5" 
          gutterBottom
          sx={{ 
            fontSize: { xs: '1.5rem', sm: '2rem' },
            mb: 3
          }}
        >
          Edit Bid — {bid.customerName}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Customer Name"
            name="customerName"
            value={bid.customerName || ""}
            onChange={handleChange}
            fullWidth
            required
          />

          <TextField
            label="Amount ($)"
            name="amount"
            type="number"
            value={bid.amount || ""}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ min: 0, step: "0.01" }}
          />

          <TextField
            label="Description"
            name="description"
            multiline
            rows={4}
            value={bid.description || ""}
            onChange={handleChange}
            fullWidth
            helperText="Describe the work to be done"
          />

          <TextField
            label="Materials"
            name="materials"
            multiline
            rows={3}
            value={bid.materials || ""}
            onChange={handleChange}
            fullWidth
            helperText="List materials needed for the job"
          />

          <TextField
            label="Notes"
            name="notes"
            multiline
            rows={2}
            value={bid.notes || ""}
            onChange={handleChange}
            fullWidth
            helperText="Internal notes (not shown to customer)"
          />

          {bid.createdAt && (
            <Typography variant="caption" color="text.secondary">
              Created: {new Date(bid.createdAt).toLocaleString()}
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={handleSave} 
              disabled={saving}
              size="large"
              sx={{ minWidth: 120 }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={() => navigate("/bids")}
              size="large"
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}