import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, updateDoc, collection, getDocs, query, where, or } from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  CircularProgress,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Swal from "sweetalert2";

const TAG_OPTIONS = ["VIP", "weekly-mowing", "commercial", "residential", "priority"];

export default function CustomerEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "AZ",
    zip: "",
    notes: "",
    tags: [],
  });

  const isNewCustomer = id === "new";

  useEffect(() => {
    if (!isNewCustomer) {
      loadCustomer();
    }
  }, [id, isNewCustomer]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "customers", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setCustomer({ id: docSnap.id, ...docSnap.data() });
      } else {
        Swal.fire("Not Found", "Customer not found", "error");
        navigate("/customers");
      }
    } catch (error) {
      console.error("Error loading customer:", error);
      Swal.fire("Error", "Failed to load customer", "error");
      navigate("/customers");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomer({ ...customer, [name]: value });
  };

  const handleTagsChange = (event) => {
    const {
      target: { value },
    } = event;
    setCustomer({
      ...customer,
      tags: typeof value === "string" ? value.split(",") : value,
    });
  };

  const checkForDuplicates = async () => {
    try {
      const customersRef = collection(db, "customers");
      
      // Check for exact name match or phone match
      const nameQuery = query(customersRef, where("name", "==", customer.name.trim()));
      const phoneQuery = query(customersRef, where("phone", "==", customer.phone.trim()));
      
      const [nameResults, phoneResults] = await Promise.all([
        getDocs(nameQuery),
        getDocs(phoneQuery)
      ]);
      
      const duplicates = [];
      const seenIds = new Set();
      
      // Collect unique duplicates
      nameResults.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          duplicates.push({ id: doc.id, ...doc.data(), matchType: 'name' });
        }
      });
      
      phoneResults.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          duplicates.push({ id: doc.id, ...doc.data(), matchType: 'phone' });
        } else {
          // If already added by name, mark as both
          const existing = duplicates.find(d => d.id === doc.id);
          if (existing) existing.matchType = 'both';
        }
      });
      
      return duplicates;
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return [];
    }
  };

  const handleSave = async () => {
        // Validation - Phase 2A: address is now required
    if (!customer.name || !customer.phone || !customer.address) {
      const missing = [];
      if (!customer.name) missing.push("Name");
      if (!customer.phone) missing.push("Phone");
      if (!customer.address) missing.push("Address");
      Swal.fire(
        "Missing Info",
        `The following fields are required: ${missing.join(", ")}`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      // Check for duplicates BEFORE creating a new customer
      if (isNewCustomer) {
        const duplicates = await checkForDuplicates();
        
        if (duplicates.length > 0) {
          setSaving(false);
          
          // Build HTML for duplicate info
          const duplicate = duplicates[0]; // Show first match
          const matchInfo = duplicate.matchType === 'both' 
            ? 'name and phone number'
            : duplicate.matchType === 'name' 
            ? 'name' 
            : 'phone number';
          
          const result = await Swal.fire({
            icon: "warning",
            title: "Possible Duplicate Found!",
            html: `
              <div style="text-align: left;">
                <p>A customer with the same <strong>${matchInfo}</strong> already exists:</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 5px 0;"><strong>Name:</strong> ${duplicate.name}</p>
                  ${duplicate.phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${duplicate.phone}</p>` : ''}
                  ${duplicate.email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${duplicate.email}</p>` : ''}
                  ${duplicate.address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${duplicate.address}</p>` : ''}
                </div>
                <p>What would you like to do?</p>
              </div>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'View Existing Customer',
            denyButtonText: 'Create Anyway',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#2196f3',
            denyButtonColor: '#ff9800',
          });
          
          if (result.isConfirmed) {
            // Navigate to existing customer
            navigate(`/customer/${duplicate.id}`);
            return;
          } else if (result.isDenied) {
            // User wants to create anyway, continue with save
            setSaving(true);
          } else {
            // User cancelled
            return;
          }
        }
      }
      
      const customerData = {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "AZ",
        zip: customer.zip || "",
        notes: customer.notes || "",
        tags: customer.tags || [],
        updatedAt: new Date().toISOString(),
      };

      if (isNewCustomer) {
        customerData.createdAt = new Date().toISOString();
        customerData.lifetimeValue = 0;
        customerData.bidCount = 0;
        customerData.contractCount = 0;
        customerData.invoiceCount = 0;
        customerData.jobCount = 0;
        
        const docRef = await addDoc(collection(db, "customers"), customerData);
        
        await Swal.fire({
          icon: "success",
          title: "Customer Added!",
          text: `${customer.name} has been added to your customers.`,
          timer: 2000,
          showConfirmButton: false,
        });
        
        navigate("/customers");
      } else {
        await updateDoc(doc(db, "customers", id), customerData);
        
        await Swal.fire({
          icon: "success",
          title: "Customer Updated!",
          text: `${customer.name}'s information has been updated.`,
          timer: 2000,
          showConfirmButton: false,
        });
        
        navigate("/customers");
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      Swal.fire("Error", "Failed to save customer", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading customer...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/customers")}
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isNewCustomer ? "Add New Customer" : "Edit Customer"}
        </Typography>
      </Box>

      {/* Form */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Name */}
          <TextField
            label="Customer Name"
            name="name"
            value={customer.name}
            onChange={handleChange}
            required
            fullWidth
            placeholder="e.g., Mrs. Sarah Smith"
          />

          {/* Phone */}
          <TextField
            label="Phone Number"
            name="phone"
            value={customer.phone}
            onChange={handleChange}
            required
            fullWidth
            placeholder="e.g., 928-555-1234"
            type="tel"
          />

          {/* Email */}
          <TextField
            label="Email Address"
            name="email"
            value={customer.email}
            onChange={handleChange}
            fullWidth
            placeholder="e.g., sarah.smith@email.com"
            type="email"
          />

          {/* Address */}
                    <TextField
            label="Street Address"
            name="address"
            value={customer.address}
            onChange={handleChange}
            required
            fullWidth
            placeholder="e.g., 123 Desert View Dr"
            helperText="Required – needed for scheduling and GPS navigation"
          />

          {/* City, State, Zip */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="City"
              name="city"
              value={customer.city}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Bullhead City"
            />
            <TextField
              label="State"
              name="state"
              value={customer.state}
              onChange={handleChange}
              fullWidth
              placeholder="AZ"
            />
            <TextField
              label="ZIP Code"
              name="zip"
              value={customer.zip}
              onChange={handleChange}
              fullWidth
              placeholder="86442"
            />
          </Box>

          {/* Tags */}
          <FormControl fullWidth>
            <InputLabel>Tags</InputLabel>
            <Select
              multiple
              value={customer.tags || []}
              onChange={handleTagsChange}
              input={<OutlinedInput label="Tags" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      color={value === "VIP" ? "warning" : "default"}
                    />
                  ))}
                </Box>
              )}
            >
              {TAG_OPTIONS.map((tag) => (
                <MenuItem key={tag} value={tag}>
                  {tag}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Notes */}
          <TextField
            label="Notes / Special Instructions"
            name="notes"
            value={customer.notes}
            onChange={handleChange}
            fullWidth
            multiline
            rows={4}
            placeholder="e.g., Gate code: 1234, Dog in backyard, Prefers text communication"
            helperText="Add gate codes, preferences, special instructions, etc."
          />

          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              fullWidth
              size="large"
            >
              {saving ? <CircularProgress size={24} /> : isNewCustomer ? "Add Customer" : "Save Changes"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate("/customers")}
              disabled={saving}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Quick Tips */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: "#f5f5f5" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          ðŸ’¡ Pro Tips:
        </Typography>
        <Typography variant="body2" component="div">
          â€¢ Add gate codes and special instructions in Notes
          <br />
          â€¢ Use VIP tag for your best customers
          <br />
          â€¢ Use weekly-mowing tag for recurring customers
          <br />
          â€¢ Full address helps with GPS navigation
          <br />â€¢ Phone number is required for calling/texting
        </Typography>
      </Paper>
    </Box>
  );
}