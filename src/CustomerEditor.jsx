import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
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
  Alert,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Swal from "sweetalert2";

const TAG_OPTIONS = ["VIP", "weekly-mowing", "commercial", "residential", "priority"];

function splitFullName(fullName = "") {
  const trimmed = (fullName || "").trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CustomerEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
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
        const data = docSnap.data();

        let firstName = data.firstName || "";
        let lastName = data.lastName || "";

        if (!firstName || !lastName) {
          const split = splitFullName(data.name || "");
          firstName = firstName || split.firstName;
          lastName = lastName || split.lastName;
        }

        setCustomer({
          id: docSnap.id,
          firstName,
          lastName,
          name: data.name || `${firstName} ${lastName}`.trim(),
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "AZ",
          zip: data.zip || "",
          notes: data.notes || "",
          tags: data.tags || [],
        });
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
    setCustomer((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTagsChange = (event) => {
    const {
      target: { value },
    } = event;

    setCustomer((prev) => ({
      ...prev,
      tags: typeof value === "string" ? value.split(",") : value,
    }));
  };

  const checkForDuplicates = async () => {
    try {
      const customersRef = collection(db, "customers");

      const normalizedEmail = customer.email.trim().toLowerCase();
      const normalizedPhone = customer.phone.trim();
      const normalizedFirstName = customer.firstName.trim().toLowerCase();
      const normalizedLastName = customer.lastName.trim().toLowerCase();
      const normalizedAddress = customer.address.trim().toLowerCase();

      const duplicateMatches = [];
      const seenIds = new Set();

      // Check email duplicates
      if (normalizedEmail) {
        const emailQuery = query(customersRef, where("email", "==", normalizedEmail));
        const emailResults = await getDocs(emailQuery);

        emailResults.forEach((snap) => {
          if (snap.id === id) return;
          if (!seenIds.has(snap.id)) {
            seenIds.add(snap.id);
            duplicateMatches.push({
              id: snap.id,
              ...snap.data(),
              matchType: "email",
            });
          }
        });
      }

      // Check phone duplicates
      if (normalizedPhone) {
        const phoneQuery = query(customersRef, where("phone", "==", normalizedPhone));
        const phoneResults = await getDocs(phoneQuery);

        phoneResults.forEach((snap) => {
          if (snap.id === id) return;
          const existing = duplicateMatches.find((d) => d.id === snap.id);

          if (existing) {
            existing.matchType = existing.matchType.includes("phone")
              ? existing.matchType
              : `${existing.matchType} + phone`;
          } else if (!seenIds.has(snap.id)) {
            seenIds.add(snap.id);
            duplicateMatches.push({
              id: snap.id,
              ...snap.data(),
              matchType: "phone",
            });
          }
        });
      }

      // Check same name + same address duplicates
      const nameQuery = query(customersRef, where("name", "==", `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim()));
      const nameResults = await getDocs(nameQuery);

      nameResults.forEach((snap) => {
        if (snap.id === id) return;

        const data = snap.data();
        const snapAddress = (data.address || "").trim().toLowerCase();

        const sameName =
          ((data.firstName || splitFullName(data.name || "").firstName).trim().toLowerCase() === normalizedFirstName) &&
          ((data.lastName || splitFullName(data.name || "").lastName).trim().toLowerCase() === normalizedLastName);

        const sameAddress = snapAddress && normalizedAddress && snapAddress === normalizedAddress;

        if (sameName && sameAddress) {
          const existing = duplicateMatches.find((d) => d.id === snap.id);

          if (existing) {
            existing.matchType = existing.matchType.includes("same name + address")
              ? existing.matchType
              : `${existing.matchType} + same name + address`;
          } else if (!seenIds.has(snap.id)) {
            seenIds.add(snap.id);
            duplicateMatches.push({
              id: snap.id,
              ...data,
              matchType: "same name + address",
            });
          }
        }
      });

      return duplicateMatches;
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return [];
    }
  };

  const handleSave = async () => {
    const missing = [];

    if (!customer.firstName.trim()) missing.push("First Name");
    if (!customer.lastName.trim()) missing.push("Last Name");
    if (!customer.phone.trim()) missing.push("Phone Number");
    if (!customer.email.trim()) missing.push("Email Address");
    if (!customer.address.trim()) missing.push("Street Address");
    if (!customer.city.trim()) missing.push("City");
    if (!customer.state.trim()) missing.push("State");
    if (!customer.zip.trim()) missing.push("ZIP Code");

    if (missing.length > 0) {
      Swal.fire(
        "Missing Required Information",
        `The following fields are required: ${missing.join(", ")}`,
        "warning"
      );
      return;
    }

    if (!isValidEmail(customer.email)) {
      Swal.fire(
        "Invalid Email",
        "Please enter a valid email address. Email is required for bids, contracts, invoices, and payment requests.",
        "warning"
      );
      return;
    }

    setSaving(true);

    try {
      const duplicates = await checkForDuplicates();

      if (duplicates.length > 0) {
        setSaving(false);

        const duplicate = duplicates[0];
        const displayName =
          duplicate.name ||
          `${duplicate.firstName || ""} ${duplicate.lastName || ""}`.trim();

        await Swal.fire({
          icon: "error",
          title: "Duplicate Customer Blocked",
          html: `
            <div style="text-align:left;">
              <p>This customer cannot be saved because a duplicate already exists.</p>
              <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:15px 0;">
                <p style="margin:5px 0;"><strong>Existing Customer:</strong> ${displayName || "Unknown"}</p>
                ${duplicate.phone ? `<p style="margin:5px 0;"><strong>Phone:</strong> ${duplicate.phone}</p>` : ""}
                ${duplicate.email ? `<p style="margin:5px 0;"><strong>Email:</strong> ${duplicate.email}</p>` : ""}
                ${duplicate.address ? `<p style="margin:5px 0;"><strong>Address:</strong> ${duplicate.address}</p>` : ""}
                <p style="margin:5px 0;"><strong>Duplicate Match Type:</strong> ${duplicate.matchType}</p>
              </div>
              <p>Use the existing customer record instead of creating a duplicate.</p>
            </div>
          `,
          confirmButtonText: "Open Existing Customer",
          confirmButtonColor: "#1976d2",
        });

        navigate(`/customer/${duplicate.id}`);
        return;
      }

      const fullName = `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim();

      const customerData = {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName.trim(),
        name: fullName,
        phone: customer.phone.trim(),
        email: customer.email.trim().toLowerCase(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        zip: customer.zip.trim(),
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

        await addDoc(collection(db, "customers"), customerData);

        await Swal.fire({
          icon: "success",
          title: "Customer Added!",
          text: `${fullName} has been added to your customers.`,
          timer: 2000,
          showConfirmButton: false,
        });

        navigate("/customers");
      } else {
        await updateDoc(doc(db, "customers", id), customerData);

        await Swal.fire({
          icon: "success",
          title: "Customer Updated!",
          text: `${fullName}'s information has been updated.`,
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
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
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Customers must have first name, last name, phone number, email, street address, city, state, and ZIP code before saving.
        Email is required for bids, contracts, invoices, and payment requests. Address is required for scheduling and geofencing.
      </Alert>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="First Name"
              name="firstName"
              value={customer.firstName}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., John"
            />
            <TextField
              label="Last Name"
              name="lastName"
              value={customer.lastName}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., Wayne"
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
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
            <TextField
              label="Email Address"
              name="email"
              value={customer.email}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., john.wayne@email.com"
              type="email"
            />
          </Box>

          <TextField
            label="Street Address"
            name="address"
            value={customer.address}
            onChange={handleChange}
            required
            fullWidth
            placeholder="e.g., 123 Desert View Dr"
            helperText="Required for scheduling, job-site records, and geofencing"
          />

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
              required
              fullWidth
              placeholder="e.g., Bullhead City"
            />
            <TextField
              label="State"
              name="state"
              value={customer.state}
              onChange={handleChange}
              required
              fullWidth
              placeholder="AZ"
            />
            <TextField
              label="ZIP Code"
              name="zip"
              value={customer.zip}
              onChange={handleChange}
              required
              fullWidth
              placeholder="86442"
            />
          </Box>

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

          <TextField
            label="Notes / Special Instructions"
            name="notes"
            value={customer.notes}
            onChange={handleChange}
            fullWidth
            multiline
            rows={4}
            placeholder="e.g., Gate code, dog in backyard, preferred communication, crew notes"
            helperText="Use this for gate codes, property notes, pet warnings, and service instructions."
          />

          <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
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

      <Paper sx={{ p: 2, mt: 3, bgcolor: "#f5f5f5" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Pro Tips
        </Typography>
        <Typography variant="body2" component="div">
          • No duplicate customers are allowed
          <br />
          • Use the existing customer record for multiple bids, jobs, invoices, and payments
          <br />
          • Full address is required for scheduling and geofencing
          <br />
          • Email is required for digital sends and payment workflows
          <br />
          • Use Notes for gate codes, dog warnings, and property instructions
        </Typography>
      </Paper>
    </Box>
  );
}