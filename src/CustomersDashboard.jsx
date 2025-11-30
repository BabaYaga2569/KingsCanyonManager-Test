import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  migrateCustomersFromExistingData,
  previewCustomerMigration,
} from "./utils/migrateCustomers";

export default function CustomersDashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchCustomers = async () => {
    try {
      const snap = await getDocs(collection(db, "customers"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by lifetime value descending
      data.sort((a, b) => (b.lifetimeValue || 0) - (a.lifetimeValue || 0));
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenMigration = async () => {
    setMigrationOpen(true);
    try {
      const preview = await previewCustomerMigration();
      setMigrationPreview(preview);
    } catch (error) {
      console.error("Preview error:", error);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const results = await migrateCustomersFromExistingData();
      console.log("Migration results:", results);
      
      if (results.errors.length > 0) {
        alert(`Migration completed with errors:\n${results.errors.join("\n")}`);
      }
      
      setMigrationComplete(true);
      
      // Refresh customer list
      await fetchCustomers();
    } catch (error) {
      console.error("Migration error:", error);
      alert("Migration failed. Check console for details.");
    } finally {
      setMigrating(false);
    }
  };

  const handleCloseMigration = () => {
    setMigrationOpen(false);
    setMigrationPreview(null);
    setMigrationComplete(false);
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading customers...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          Customers
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {customers.length === 0 && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<CloudUploadIcon />}
              onClick={handleOpenMigration}
            >
              Import Existing Customers
            </Button>
          )}
          <Button
            variant="contained"
            color="success"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate("/customer/new")}
          >
            Add Customer
          </Button>
        </Box>
      </Box>

      {customers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Customers Yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Get started by importing your existing customers from invoices, contracts, and jobs.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<CloudUploadIcon />}
            onClick={handleOpenMigration}
          >
            Import Customers from Existing Data
          </Button>
        </Paper>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {customers.map((customer) => (
              <Card key={customer.id} sx={{ mb: 2, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {customer.name}
                  </Typography>
                  {customer.email && (
                    <Typography variant="body2" color="text.secondary">
                      {customer.email}
                    </Typography>
                  )}
                  {customer.phone && (
                    <Typography variant="body2" color="text.secondary">
                      {customer.phone}
                    </Typography>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={`Lifetime Value: $${(customer.lifetimeValue || 0).toFixed(2)}`}
                      color="success"
                      sx={{ fontWeight: "bold" }}
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => navigate(`/customer/${customer.id}`)}
                    fullWidth
                  >
                    View Profile
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>

          {/* Desktop: Table Layout */}
          <Paper sx={{ display: { xs: "none", md: "block" }, borderRadius: 2, overflowX: "auto", boxShadow: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Lifetime Value</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.email || "—"}</TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        label={`$${(customer.lifetimeValue || 0).toFixed(2)}`}
                        color="success"
                        size="small"
                        sx={{ fontWeight: "bold" }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => navigate(`/customer/${customer.id}`)}
                      >
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Migration Dialog */}
      <Dialog 
        open={migrationOpen} 
        onClose={handleCloseMigration}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {migrationComplete ? "Migration Complete!" : "Import Existing Customers"}
        </DialogTitle>
        <DialogContent>
          {migrationComplete ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully imported your existing customers! All invoices, contracts, jobs, and bids have been linked to their customer records.
            </Alert>
          ) : migrationPreview ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                We found {migrationPreview.totalCustomers} unique customers in your existing data. Click "Import Now" to create customer records and link all your documents.
              </Alert>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Preview of Customers to Import:
              </Typography>

              <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                {migrationPreview.customers.slice(0, 10).map((customer, idx) => (
                  <Paper key={idx} sx={{ p: 2, mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {customer.name}
                    </Typography>
                    {customer.email && (
                      <Typography variant="body2">{customer.email}</Typography>
                    )}
                    {customer.phone && (
                      <Typography variant="body2">{customer.phone}</Typography>
                    )}
                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip label={`${customer.invoiceCount} Invoices`} size="small" />
                      <Chip label={`${customer.contractCount} Contracts`} size="small" />
                      <Chip label={`${customer.jobCount} Jobs`} size="small" />
                      <Chip label={`${customer.bidCount} Bids`} size="small" />
                      {customer.lifetimeValue > 0 && (
                        <Chip
                          label={`$${customer.lifetimeValue.toFixed(2)} Paid`}
                          color="success"
                          size="small"
                        />
                      )}
                    </Box>
                  </Paper>
                ))}
                {migrationPreview.customers.length > 10 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    ...and {migrationPreview.customers.length - 10} more customers
                  </Typography>
                )}
              </Box>

              <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
                <Typography variant="h6">
                  Total Lifetime Value: ${migrationPreview.totalLifetimeValue.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Based on paid invoices
                </Typography>
              </Box>
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Scanning your data...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMigration}>
            {migrationComplete ? "Close" : "Cancel"}
          </Button>
          {!migrationComplete && migrationPreview && (
            <Button
              variant="contained"
              onClick={handleMigrate}
              disabled={migrating}
              startIcon={migrating ? <CircularProgress size={20} /> : <CloudUploadIcon />}
            >
              {migrating ? "Importing..." : "Import Now"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}