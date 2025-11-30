import React, { useState, useEffect } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db, bidsCollection } from "./firebase";
import { 
  TextField, 
  Button, 
  Container, 
  Typography,
  Box,
  Paper,
  Autocomplete,
  Link as MuiLink,
  Alert,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

export default function CreateBid() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [notes, setNotes] = useState("");
  const navigate = useNavigate();

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, "customers"));
        const customerList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCustomers(customerList);
      } catch (error) {
        console.error("Error fetching customers:", error);
        // If customers collection doesn't exist yet, that's okay
        // User can still create bids manually
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, []);

  // Auto-fill customer info when selected
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !amount) {
      Swal.fire("Missing info", "Customer and Amount are required.", "warning");
      return;
    }

    try {
      const bidData = {
        customerName,
        amount: parseFloat(amount),
        description: description || "",
        materials: materials || "",
        notes: notes || "",
        createdAt: new Date().toISOString(),
      };

      // Link to customer if one is selected
      if (selectedCustomer) {
        bidData.customerId = selectedCustomer.id;
        bidData.customerEmail = customerEmail;
        bidData.customerPhone = customerPhone;
        bidData.customerAddress = customerAddress;
      }

      await addDoc(bidsCollection, bidData);

      await Swal.fire("✅ Bid saved", "Your bid was created.", "success");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerAddress("");
      setAmount("");
      setDescription("");
      setMaterials("");
      setNotes("");
      setSelectedCustomer(null);
      navigate("/bids");
    } catch (err) {
      console.error("Error adding bid:", err);
      Swal.fire("Error", "Could not save the bid.", "error");
    }
  };

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
          Create New Bid
        </Typography>

        {customers.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No customers found yet. You can create bids manually by entering customer information below, or visit the{" "}
            <MuiLink
              component="button"
              onClick={() => navigate("/customers")}
              sx={{ fontWeight: "bold" }}
            >
              Customers page
            </MuiLink>{" "}
            to import existing customers or add new ones.
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          {/* Customer Selection */}
          {customers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name || ""}
                value={selectedCustomer}
                onChange={handleCustomerSelect}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing Customer (Optional)"
                    helperText="Choose from existing customers or enter new customer details below"
                  />
                )}
                fullWidth
              />
              <Button
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={() => navigate("/customer/new")}
                sx={{ mt: 1 }}
              >
                Add New Customer
              </Button>
            </Box>
          )}

          {/* Customer Info */}
          <TextField
            label="Customer Name"
            fullWidth
            margin="normal"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            sx={{ mb: 2 }}
            disabled={!!selectedCustomer}
            helperText={selectedCustomer ? "Auto-filled from selected customer" : ""}
          />

          <TextField
            label="Customer Email"
            type="email"
            fullWidth
            margin="normal"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!!selectedCustomer}
          />

          <TextField
            label="Customer Phone"
            fullWidth
            margin="normal"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!!selectedCustomer}
          />

          <TextField
            label="Customer Address"
            fullWidth
            margin="normal"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!!selectedCustomer}
          />

          {/* Bid Details */}
          <TextField
            label="Amount ($)"
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
            type="submit"
            fullWidth
            size="large"
            sx={{ 
              py: 1.5,
              fontSize: { xs: '1rem', sm: '1.1rem' }
            }}
          >
            Save Bid
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}