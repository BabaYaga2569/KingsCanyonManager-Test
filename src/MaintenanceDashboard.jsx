import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  IconButton,
  useMediaQuery,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReceiptIcon from "@mui/icons-material/Receipt";
import moment from "moment";

export default function MaintenanceDashboard() {
  const [contracts, setContracts] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const snap = await getDocs(collection(db, "maintenance_contracts"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Sort by status (active first) then by customer name
      data.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return (a.customerName || "").localeCompare(b.customerName || "");
      });
      
      setContracts(data);
    } catch (error) {
      console.error("Error fetching maintenance contracts:", error);
      Swal.fire("Error", "Failed to load maintenance contracts", "error");
    }
  };

  const handleDelete = async (id, customerName) => {
    const result = await Swal.fire({
      title: `Delete Maintenance Contract?`,
      text: `Remove ${customerName}'s maintenance agreement?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "maintenance_contracts", id));
        setContracts(contracts.filter((c) => c.id !== id));
        Swal.fire("Deleted!", "Maintenance contract removed", "success");
      } catch (error) {
        console.error("Error deleting contract:", error);
        Swal.fire("Error", "Failed to delete contract", "error");
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    
    try {
      await updateDoc(doc(db, "maintenance_contracts", id), {
        status: newStatus,
      });
      
      setContracts(contracts.map((c) =>
        c.id === id ? { ...c, status: newStatus } : c
      ));
      
      Swal.fire({
        title: newStatus === "active" ? "Resumed!" : "Paused!",
        text: `Maintenance contract ${newStatus === "active" ? "resumed" : "paused"}`,
        icon: "success",
        timer: 2000,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  const getFrequencyDisplay = (frequency) => {
    switch (frequency) {
      case "weekly": return "Weekly";
      case "biweekly": return "Every 2 Weeks";
      case "monthly": return "Monthly";
      default: return frequency;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "success";
      case "paused": return "warning";
      case "cancelled": return "error";
      default: return "default";
    }
  };

  const getNextVisitDate = (contract) => {
    if (!contract.lastVisitDate) {
      return contract.startDate || "Not scheduled";
    }
    
    const lastVisit = moment(contract.lastVisitDate);
    let nextVisit;
    
    switch (contract.frequency) {
      case "weekly":
        nextVisit = lastVisit.add(1, "week");
        break;
      case "biweekly":
        nextVisit = lastVisit.add(2, "weeks");
        break;
      case "monthly":
        nextVisit = lastVisit.add(1, "month");
        break;
      default:
        return "Unknown";
    }
    
    return nextVisit.format("MMM DD, YYYY");
  };

  const filteredContracts = contracts.filter((contract) => {
    if (filterStatus === "all") return true;
    return contract.status === filterStatus;
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          🌿 Monthly Maintenance ({filteredContracts.length})
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filterStatus}
              label="Filter"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All Contracts</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="paused">Paused Only</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/maintenance/new")}
            sx={{ whiteSpace: "nowrap" }}
          >
            {isMobile ? "Add" : "New Contract"}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#e8f5e9" }}>
            <Typography variant="h4" color="success.main">
              {contracts.filter((c) => c.status === "active").length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Contracts
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#fff3e0" }}>
            <Typography variant="h4" color="warning.main">
              {contracts.filter((c) => c.status === "paused").length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paused
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#e3f2fd" }}>
            <Typography variant="h4" color="primary.main">
              ${contracts
                .filter((c) => c.status === "active")
                .reduce((sum, c) => sum + (parseFloat(c.monthlyRate) || 0), 0)
                .toFixed(0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monthly Revenue
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#fce4ec" }}>
            <Typography variant="h4" color="error.main">
              {contracts.filter((c) => c.status === "cancelled").length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cancelled
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Empty State */}
      {filteredContracts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CalendarMonthIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Maintenance Contracts Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create recurring maintenance agreements for steady monthly revenue
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/maintenance/new")}
          >
            Create First Contract
          </Button>
        </Paper>
      )}

      {/* Contracts Grid */}
      <Grid container spacing={2}>
        {filteredContracts.map((contract) => (
          <Grid item xs={12} md={6} lg={4} key={contract.id}>
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Status and Frequency */}
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                  <Chip
                    label={contract.status || "active"}
                    color={getStatusColor(contract.status)}
                    size="small"
                    sx={{ fontWeight: "bold", textTransform: "capitalize" }}
                  />
                  <Chip
                    label={getFrequencyDisplay(contract.frequency)}
                    variant="outlined"
                    size="small"
                  />
                </Box>

                {/* Customer Name */}
                <Typography variant="h6" gutterBottom>
                  {contract.customerName}
                </Typography>

                {/* Monthly Rate */}
                <Typography variant="h5" color="primary" sx={{ mb: 2, fontWeight: "bold" }}>
                  ${contract.monthlyRate}/mo
                </Typography>

                {/* Services */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>Services:</strong>
                  <br />
                  {contract.servicesIncluded || "Standard maintenance"}
                </Typography>

                {/* Next Visit */}
                <Typography variant="body2" color="text.secondary">
                  <strong>Next Visit:</strong> {getNextVisitDate(contract)}
                </Typography>

                {/* Start Date */}
                <Typography variant="caption" color="text.secondary">
                  Started: {moment(contract.startDate).format("MMM DD, YYYY")}
                </Typography>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0, flexWrap: "wrap", gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/maintenance/${contract.id}`)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={contract.status === "active" ? <PauseIcon /> : <PlayArrowIcon />}
                  onClick={() => handleToggleStatus(contract.id, contract.status)}
                  color={contract.status === "active" ? "warning" : "success"}
                >
                  {contract.status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button
                  size="small"
                  startIcon={<ReceiptIcon />}
                  onClick={() => navigate(`/invoice/new?maintenanceId=${contract.id}`)}
                  color="success"
                >
                  Invoice
                </Button>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(contract.id, contract.customerName)}
                  color="error"
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}