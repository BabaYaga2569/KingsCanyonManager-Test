import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Divider,
  Chip,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptIcon from "@mui/icons-material/Receipt";
import WorkIcon from "@mui/icons-material/Work";
import Swal from "sweetalert2";

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [linkedDocs, setLinkedDocs] = useState({
    bids: [],
    contracts: [],
    invoices: [],
    jobs: [],
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        if (id === "new") {
          // New customer mode
          setCustomer({
            name: "",
            email: "",
            phone: "",
            address: "",
            notes: "",
            lifetimeValue: 0,
          });
          setEditing(true);
          setLoading(false);
          return;
        }

        // Fetch customer
        const customerDoc = await getDoc(doc(db, "customers", id));
        if (!customerDoc.exists()) {
          Swal.fire("Not Found", "Customer not found.", "error");
          navigate("/customers");
          return;
        }

        const customerData = { id: customerDoc.id, ...customerDoc.data() };
        setCustomer(customerData);

        // Fetch all linked documents
        const [bids, contracts, invoices, jobs] = await Promise.all([
          getDocs(query(collection(db, "bids"), where("customerId", "==", id))),
          getDocs(query(collection(db, "contracts"), where("customerId", "==", id))),
          getDocs(query(collection(db, "invoices"), where("customerId", "==", id))),
          getDocs(query(collection(db, "jobs"), where("customerId", "==", id))),
        ]);

        setLinkedDocs({
          bids: bids.docs.map(d => ({ id: d.id, ...d.data() })),
          contracts: contracts.docs.map(d => ({ id: d.id, ...d.data() })),
          invoices: invoices.docs.map(d => ({ id: d.id, ...d.data() })),
          jobs: jobs.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (error) {
        console.error("Error fetching customer:", error);
        Swal.fire("Error", "Failed to load customer data.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!customer.name.trim()) {
      Swal.fire("Missing Name", "Customer name is required.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (id === "new") {
        // Create new customer
        const { addDoc } = await import("firebase/firestore");
        const newCustomerRef = await addDoc(collection(db, "customers"), {
          name: customer.name,
          email: customer.email || "",
          phone: customer.phone || "",
          address: customer.address || "",
          notes: customer.notes || "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
        });
        
        Swal.fire("Success", "Customer created successfully!", "success");
        navigate(`/customer/${newCustomerRef.id}`);
      } else {
        // Update existing customer
        await updateDoc(doc(db, "customers", id), {
          name: customer.name,
          email: customer.email || "",
          phone: customer.phone || "",
          address: customer.address || "",
          notes: customer.notes || "",
        });
        
        Swal.fire("Success", "Customer updated successfully!", "success");
        setEditing(false);
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      Swal.fire("Error", "Failed to save customer.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading customer...</Typography>
      </Box>
    );
  }

  if (!customer) {
    return null;
  }

  const isNewCustomer = id === "new";

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pb: 6 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/customers")}
        sx={{ mb: 2 }}
      >
        Back to Customers
      </Button>

      {/* Customer Info Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h5">
            {isNewCustomer ? "New Customer" : customer.name}
          </Typography>
          {!isNewCustomer && !editing && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Customer Name"
              value={customer.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              fullWidth
              disabled={!editing}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Email"
              type="email"
              value={customer.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              fullWidth
              disabled={!editing}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Phone"
              value={customer.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              fullWidth
              disabled={!editing}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Lifetime Value"
              value={`$${(customer.lifetimeValue || 0).toFixed(2)}`}
              fullWidth
              disabled
              InputProps={{
                style: { fontWeight: "bold", color: "#4caf50" }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address"
              multiline
              rows={2}
              value={customer.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              fullWidth
              disabled={!editing}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={customer.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              fullWidth
              disabled={!editing}
              placeholder="Add any notes about this customer..."
            />
          </Grid>
        </Grid>

        {editing && (
          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {!isNewCustomer && (
              <Button
                variant="outlined"
                onClick={() => {
                  setEditing(false);
                  // Reset to original data
                  const fetchCustomer = async () => {
                    const customerDoc = await getDoc(doc(db, "customers", id));
                    setCustomer({ id: customerDoc.id, ...customerDoc.data() });
                  };
                  fetchCustomer();
                }}
              >
                Cancel
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Service History */}
      {!isNewCustomer && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Service History
          </Typography>

          <Grid container spacing={2}>
            {/* Bids */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <RequestQuoteIcon sx={{ mr: 1, color: "primary.main" }} />
                    <Typography variant="h6">
                      Bids ({linkedDocs.bids.length})
                    </Typography>
                  </Box>
                  {linkedDocs.bids.length === 0 ? (
                    <Typography color="text.secondary">No bids yet</Typography>
                  ) : (
                    <List dense>
                      {linkedDocs.bids.map((bid) => (
                        <ListItemButton
                          key={bid.id}
                          onClick={() => navigate("/bids")}
                        >
                          <ListItemText
                            primary={`$${bid.amount || 0} - ${bid.description?.substring(0, 50) || "No description"}`}
                            secondary={new Date(bid.createdAt).toLocaleDateString()}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Contracts */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <DescriptionIcon sx={{ mr: 1, color: "info.main" }} />
                    <Typography variant="h6">
                      Contracts ({linkedDocs.contracts.length})
                    </Typography>
                  </Box>
                  {linkedDocs.contracts.length === 0 ? (
                    <Typography color="text.secondary">No contracts yet</Typography>
                  ) : (
                    <List dense>
                      {linkedDocs.contracts.map((contract) => (
                        <ListItemButton
                          key={contract.id}
                          onClick={() => navigate(`/contract/${contract.id}`)}
                        >
                          <ListItemText
                            primary={`$${contract.amount || 0} - ${contract.status || "Pending"}`}
                            secondary={contract.description?.substring(0, 50) || "No description"}
                          />
                          <Chip label={contract.status || "Pending"} size="small" />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Invoices */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <ReceiptIcon sx={{ mr: 1, color: "success.main" }} />
                    <Typography variant="h6">
                      Invoices ({linkedDocs.invoices.length})
                    </Typography>
                  </Box>
                  {linkedDocs.invoices.length === 0 ? (
                    <Typography color="text.secondary">No invoices yet</Typography>
                  ) : (
                    <List dense>
                      {linkedDocs.invoices.map((invoice) => (
                        <ListItemButton
                          key={invoice.id}
                          onClick={() => navigate(`/invoice/${invoice.id}`)}
                        >
                          <ListItemText
                            primary={`$${invoice.total || invoice.amount || 0} - ${invoice.status || "Pending"}`}
                            secondary={invoice.description?.substring(0, 50) || "No description"}
                          />
                          <Chip
                            label={invoice.status || "Pending"}
                            color={
                              invoice.status === "Paid" ? "success" :
                              invoice.status === "Sent" ? "info" :
                              invoice.status === "Overdue" ? "error" :
                              "warning"
                            }
                            size="small"
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Jobs */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <WorkIcon sx={{ mr: 1, color: "warning.main" }} />
                    <Typography variant="h6">
                      Jobs ({linkedDocs.jobs.length})
                    </Typography>
                  </Box>
                  {linkedDocs.jobs.length === 0 ? (
                    <Typography color="text.secondary">No jobs yet</Typography>
                  ) : (
                    <List dense>
                      {linkedDocs.jobs.map((job) => (
                        <ListItem key={job.id}>
                          <ListItemText
                            primary={`${job.status || "Pending"}`}
                            secondary={job.description?.substring(0, 50) || "No description"}
                          />
                          <Chip label={job.status || "Pending"} size="small" />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}