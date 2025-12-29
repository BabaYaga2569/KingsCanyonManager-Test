import React, { useState, useEffect } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  Autocomplete,
  Divider,
} from "@mui/material";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import DesignVisualizer from "./components/DesignVisualizer";
import BrushIcon from "@mui/icons-material/Brush";

export default function CreateBid() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  // Customer selection state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [notes, setNotes] = useState("");

  // Design visualization state
  const [designData, setDesignData] = useState(null);
  const [showDesignDialog, setShowDesignDialog] = useState(false);
  const [showDesignVisualizer, setShowDesignVisualizer] = useState(false);

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, "customers"));
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCustomers(data);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomers();
  }, []);

  // Auto-fill when customer selected
  const handleCustomerSelect = (event, value) => {
    setSelectedCustomer(value);
    if (value) {
      setCustomerName(value.name || "");
      setCustomerEmail(value.email || "");
      setCustomerPhone(value.phone || "");
      setCustomerAddress(value.address || "");
    } else {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerAddress("");
    }
  };

  const handleContinueToSave = () => {
    if (!customerName || !amount) {
      Swal.fire("Missing info", "Customer Name and Amount are required.", "warning");
      return;
    }
    setShowDesignDialog(true);
  };

  const handleSkipDesign = () => {
    setShowDesignDialog(false);
    saveBidWithoutDesign();
  };

  const handleAddDesign = () => {
    setShowDesignDialog(false);
    setShowDesignVisualizer(true);
  };

  const handleDesignSaved = (design) => {
    setDesignData(design);
    setShowDesignVisualizer(false);
    saveBidWithDesign(design);
  };

  const handleCancelDesign = () => {
    setShowDesignVisualizer(false);
    setShowDesignDialog(true);
  };

  const saveBidWithoutDesign = async () => {
    try {
      let customerId = selectedCustomer?.id;

      if (!customerId) {
        const customerData = {
          name: customerName,
          email: customerEmail || "",
          phone: customerPhone || "",
          address: customerAddress || "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          bidCount: 1,
          contractCount: 0,
          invoiceCount: 0,
        };
        const customerRef = await addDoc(collection(db, "customers"), customerData);
        customerId = customerRef.id;
      }

      await addDoc(collection(db, "bids"), {
        customerId,
        customerName,
        customerEmail: customerEmail || "",
        customerPhone: customerPhone || "",
        customerAddress: customerAddress || "",
        amount: parseFloat(amount),
        description: description || "",
        materials: materials || "",
        notes: notes || "",
        createdAt: new Date().toISOString(),
        hasDesignVisualization: false,
      });

      await Swal.fire("✅ Bid saved", "Your bid was created.", "success");
      resetForm();
      navigate("/bids");
    } catch (err) {
      console.error("Error adding bid:", err);
      Swal.fire("Error", "Could not save the bid.", "error");
    }
  };

  const saveBidWithDesign = async (design) => {
    try {
      let customerId = selectedCustomer?.id;

      if (!customerId) {
        const customerData = {
          name: customerName,
          email: customerEmail || "",
          phone: customerPhone || "",
          address: customerAddress || "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          bidCount: 1,
          contractCount: 0,
          invoiceCount: 0,
        };
        const customerRef = await addDoc(collection(db, "customers"), customerData);
        customerId = customerRef.id;
      }

      await addDoc(collection(db, "bids"), {
        customerId,
        customerName,
        customerEmail: customerEmail || "",
        customerPhone: customerPhone || "",
        customerAddress: customerAddress || "",
        amount: parseFloat(amount),
        description: description || "",
        materials: materials || "",
        notes: notes || "",
        createdAt: new Date().toISOString(),
        hasDesignVisualization: true,
        designVisualization: design,
      });

      await Swal.fire("✅ Bid saved with design!", "Your bid with visualization was created.", "success");
      resetForm();
      navigate("/bids");
    } catch (err) {
      console.error("Error adding bid:", err);
      Swal.fire("Error", "Could not save the bid.", "error");
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerAddress("");
    setAmount("");
    setDescription("");
    setMaterials("");
    setNotes("");
    setDesignData(null);
  };

  if (showDesignVisualizer) {
    return (
      <DesignVisualizer
        customerName={customerName}
        onSave={handleDesignSaved}
        onCancel={handleCancelDesign}
      />
    );
  }

  return (
    <Container sx={{ mt: { xs: 2, sm: 4 }, pb: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper
        elevation={2}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            fontSize: { xs: "1.5rem", sm: "2rem" },
            mb: 3,
          }}
        >
          Create New Bid
        </Typography>

        <Box>
          {/* Customer Selection */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Customer Information
          </Typography>

          <Autocomplete
            options={customers}
            getOptionLabel={(option) => option.name}
            value={selectedCustomer}
            onChange={handleCustomerSelect}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Existing Customer (Optional)"
                helperText="Choose a customer to auto-fill their info, or enter new customer below"
              />
            )}
            sx={{ mb: 2 }}
          />

          <Divider sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR ENTER NEW CUSTOMER
            </Typography>
          </Divider>

          <TextField
            label="Customer Name *"
            fullWidth
            margin="normal"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            label="Customer Email"
            type="email"
            fullWidth
            margin="normal"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Customer Phone"
            fullWidth
            margin="normal"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Customer Address"
            fullWidth
            margin="normal"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

          {/* Bid Details */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Bid Details
          </Typography>

          <TextField
            label="Amount ($) *"
            type="number"
            fullWidth
            margin="normal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            label="Description"
            multiline
            rows={4}
            fullWidth
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Materials"
            fullWidth
            margin="normal"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes"
            multiline
            rows={2}
            fullWidth
            margin="normal"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            color="success"
            onClick={handleContinueToSave}
            fullWidth
            size="large"
            sx={{
              py: 1.5,
              fontSize: { xs: "1rem", sm: "1.1rem" },
            }}
          >
            Continue to Save
          </Button>
        </Box>
      </Paper>

      {/* Design Dialog */}
      <Dialog
        open={showDesignDialog}
        onClose={() => setShowDesignDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          🎨 Add Design Visualization?
        </DialogTitle>
        <DialogContent>
          <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <BrushIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
                <Typography variant="h6">
                  Show Your Customer What They're Getting!
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 2 }}>
                Take a photo of the jobsite and place design elements on it:
              </Typography>

              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                <li>
                  <Typography variant="body2">Pools, patios, fire pits</Typography>
                </li>
                <li>
                  <Typography variant="body2">Lighting, structures, landscaping</Typography>
                </li>
                <li>
                  <Typography variant="body2">50+ professional design elements</Typography>
                </li>
              </Box>

              <Typography variant="body2" color="primary" fontWeight="bold">
                Result: Higher close rates & happier customers!
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: "#fff3e0" }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                ⚡ Quick Bid (No Design)
              </Typography>
              <Typography variant="body2">
                Skip visualization for small jobs or maintenance work
              </Typography>
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: "column", gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<BrushIcon />}
            onClick={handleAddDesign}
          >
            Yes, Add Design
          </Button>
          <Button variant="outlined" fullWidth onClick={handleSkipDesign}>
            Skip for Now
          </Button>
          <Button variant="text" fullWidth onClick={() => setShowDesignDialog(false)}>
            Go Back
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}