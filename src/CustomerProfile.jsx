import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import Swal from "sweetalert2";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState({
    bids: [],
    contracts: [],
    invoices: [],
    jobs: [],
  });

  useEffect(() => {
    const fetchCustomerAndDocs = async () => {
      try {
        // Fetch customer
        const customerDoc = await getDoc(doc(db, "customers", id));
        if (customerDoc.exists()) {
          const customerData = { id: customerDoc.id, ...customerDoc.data() };
          setCustomer(customerData);

          // Fetch linked documents
          const [bids, contracts, invoices, jobs] = await Promise.all([
            getDocs(query(collection(db, "bids"), where("customerId", "==", id))),
            getDocs(query(collection(db, "contracts"), where("customerId", "==", id))),
            getDocs(query(collection(db, "invoices"), where("customerId", "==", id))),
            getDocs(query(collection(db, "jobs"), where("customerId", "==", id))),
          ]);

          setLinkedDocs({
            bids: bids.docs.map((d) => ({ id: d.id, ...d.data() })),
            contracts: contracts.docs.map((d) => ({ id: d.id, ...d.data() })),
            invoices: invoices.docs.map((d) => ({ id: d.id, ...d.data() })),
            jobs: jobs.docs.map((d) => ({ id: d.id, ...d.data() })),
          });
        } else {
          Swal.fire("Not Found", "Customer not found.", "error");
          navigate("/customers");
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
        Swal.fire("Error", "Failed to load customer.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerAndDocs();
  }, [id, navigate]);

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

    try {
      await updateDoc(doc(db, "customers", id), {
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || "",
      });
      Swal.fire("Saved!", "Customer updated successfully.", "success");
      setEditing(false);
    } catch (error) {
      Swal.fire("Error", "Failed to save changes.", "error");
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading customer...
        </Typography>
      </Container>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/customers")}
        sx={{ mb: 2 }}
      >
        Back to Customers
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h5">{customer.name}</Typography>
          <Button
            variant={editing ? "contained" : "outlined"}
            onClick={() => (editing ? handleSave() : setEditing(true))}
          >
            {editing ? "Save Changes" : "Edit"}
          </Button>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {editing ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Name"
              value={customer.name || ""}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={customer.email || ""}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone"
              value={customer.phone || ""}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              fullWidth
            />
                        <TextField
              label="Address"
              multiline
              rows={2}
              value={customer.address || ""}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              fullWidth
              required
              helperText="Required – needed for scheduling and GPS navigation"
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={customer.notes || ""}
              onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
              fullWidth
            />
            <Button variant="text" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </Box>
        ) : (
          <Box>
            {customer.email && (
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Email:</strong> {customer.email}
              </Typography>
            )}
            {customer.phone && (
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Phone:</strong> {customer.phone}
              </Typography>
            )}
            {customer.address && (
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Address:</strong> {customer.address}
              </Typography>
            )}
            {customer.notes && (
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Notes:</strong> {customer.notes}
              </Typography>
            )}
            <Typography variant="h6" sx={{ mt: 3 }}>
              Lifetime Value: ${(customer.lifetimeValue || 0).toLocaleString()}
            </Typography>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Service History
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
            Bids ({linkedDocs.bids.length})
          </Typography>
          {linkedDocs.bids.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No bids yet
            </Typography>
          ) : (
            <List dense>
              {linkedDocs.bids.map((bid) => (
                <ListItem key={bid.id} button onClick={() => navigate(`/bids`)}>
                  <ListItemText
                    primary={`$${bid.amount} - ${bid.description || "No description"}`}
                    secondary={bid.createdAt ? new Date(bid.createdAt).toLocaleDateString() : "N/A"}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
            Contracts ({linkedDocs.contracts.length})
          </Typography>
          {linkedDocs.contracts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No contracts yet
            </Typography>
          ) : (
            <List dense>
              {linkedDocs.contracts.map((contract) => (
                <ListItem
                  key={contract.id}
                  button
                  onClick={() => navigate(`/contract/${contract.id}`)}
                >
                  <ListItemText
                    primary={`$${contract.amount} - ${contract.description || "No description"}`}
                    secondary={
                      <Box component="span">
                        <Chip
                          label={contract.status || "Pending"}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {contract.createdAt
                          ? new Date(contract.createdAt.seconds * 1000).toLocaleDateString()
                          : "N/A"}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
            Invoices ({linkedDocs.invoices.length})
          </Typography>
          {linkedDocs.invoices.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No invoices yet
            </Typography>
          ) : (
            <List dense>
              {linkedDocs.invoices.map((invoice) => (
                <ListItem
                  key={invoice.id}
                  button
                  onClick={() => navigate(`/invoice/${invoice.id}`)}
                >
                  <ListItemText
                    primary={`$${invoice.total || invoice.amount || 0} - ${
                      invoice.description || "No description"
                    }`}
                    secondary={
                      <Box component="span">
                        <Chip
                          label={invoice.status || "Pending"}
                          size="small"
                          color={invoice.status === "Paid" ? "success" : "warning"}
                          sx={{ mr: 1 }}
                        />
                        {invoice.createdAt
                          ? new Date(invoice.createdAt.seconds * 1000).toLocaleDateString()
                          : "N/A"}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
            Jobs ({linkedDocs.jobs.length})
          </Typography>
          {linkedDocs.jobs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No jobs yet
            </Typography>
          ) : (
            <List dense>
              {linkedDocs.jobs.map((job) => (
                <ListItem key={job.id} button onClick={() => navigate(`/jobs`)}>
                  <ListItemText
                    primary={job.description || "No description"}
                    secondary={
                      <Box component="span">
                        <Chip
                          label={job.status || "Pending"}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {job.createdAt
                          ? new Date(job.createdAt.seconds * 1000).toLocaleDateString()
                          : "N/A"}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Paper>
    </Container>
  );
}