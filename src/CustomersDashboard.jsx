import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";

export default function CustomersDashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    try {
      const snap = await getDocs(collection(db, "customers"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Sort by lifetime value (highest first)
      data.sort((a, b) => (b.lifetimeValue || 0) - (a.lifetimeValue || 0));
      
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      Swal.fire("Error", "Failed to load customers.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id, name) => {
    const confirm = await Swal.fire({
      title: `Delete ${name}?`,
      text: "This will NOT delete their bids/contracts/invoices, just the customer record.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "customers", id));
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      Swal.fire("Deleted!", "Customer record removed.", "success");
    } catch (error) {
      Swal.fire("Error", "Failed to delete customer.", "error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Loading customers...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Customers ({customers.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => navigate("/customer/new")}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          Add Customer
        </Button>
        <Button
          variant="contained"
          onClick={() => navigate("/customer/new")}
          sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
        >
          <PersonAddIcon />
        </Button>
      </Box>

      {customers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Customers Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Customers will be created automatically when you create bids.<br />
            Or click "Add Customer" to add one manually.
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate("/customer/new")}
          >
            Add Your First Customer
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(auto-fill, minmax(300px, 1fr))",
            },
            gap: 2,
          }}
        >
          {customers.map((customer) => (
            <Card key={customer.id} sx={{ boxShadow: 2 }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                    {customer.name}
                  </Typography>
                  <Chip
                    label={`$${(customer.lifetimeValue || 0).toLocaleString()}`}
                    color="primary"
                    size="small"
                  />
                </Box>

                {customer.email && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    📧 {customer.email}
                  </Typography>
                )}
                {customer.phone && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    📞 {customer.phone}
                  </Typography>
                )}
                {customer.address && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    🏠 {customer.address}
                  </Typography>
                )}

                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <Chip label={`${customer.bidCount || 0} Bids`} size="small" variant="outlined" />
                  <Chip label={`${customer.contractCount || 0} Contracts`} size="small" variant="outlined" />
                  <Chip label={`${customer.invoiceCount || 0} Invoices`} size="small" variant="outlined" />
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0, flexDirection: "column", gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => navigate(`/customer/${customer.id}`)}
                  fullWidth
                >
                  View Profile
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleDelete(customer.id, customer.name)}
                  fullWidth
                  size="small"
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}