import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  Paper,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import Swal from "sweetalert2";
import AddIcon from "@mui/icons-material/Add";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

export default function JobTimeTracking() {
  const [jobs, setJobs] = useState([]);
  const [crews, setCrews] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Add time dialog
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [timeForm, setTimeForm] = useState({
    crewId: "",
    workDate: new Date().toISOString().split("T")[0],
    hoursWorked: "",
    hourlyRate: "",
    laborCost: 0,
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load jobs
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setJobs(jobsData);

      // Load crews
      const crewsSnap = await getDocs(collection(db, "crews"));
      const crewsData = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      // Load time entries
      const timeSnap = await getDocs(collection(db, "job_time_entries"));
      const timeData = timeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTimeEntries(timeData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get time entries for a specific job
  const getJobTimeEntries = (jobId) => {
    return timeEntries.filter((t) => t.jobId === jobId);
  };

  // Calculate job labor cost
  const getJobLaborCost = (jobId) => {
    const entries = getJobTimeEntries(jobId);
    return entries.reduce((sum, entry) => sum + (parseFloat(entry.laborCost) || 0), 0);
  };

  // Calculate job total hours
  const getJobTotalHours = (jobId) => {
    const entries = getJobTimeEntries(jobId);
    return entries.reduce((sum, entry) => sum + (parseFloat(entry.hoursWorked) || 0), 0);
  };

  // Calculate job profit
  const getJobProfit = (job) => {
    const revenue = parseFloat(job.amount) || 0;
    const laborCost = getJobLaborCost(job.id);
    const materialsCost = parseFloat(job.materialsCost) || 0;
    return revenue - laborCost - materialsCost;
  };

  // Get profit margin percentage
  const getProfitMargin = (job) => {
    const revenue = parseFloat(job.amount) || 0;
    if (revenue === 0) return 0;
    const profit = getJobProfit(job);
    return ((profit / revenue) * 100).toFixed(1);
  };

  // Open add time dialog
  const handleOpenTimeDialog = (job) => {
    setSelectedJob(job);
    setTimeForm({
      crewId: "",
      workDate: new Date().toISOString().split("T")[0],
      hoursWorked: "",
      hourlyRate: "",
      laborCost: 0,
      notes: "",
    });
    setTimeDialogOpen(true);
  };

  // Handle crew selection - auto-fill hourly rate
  const handleCrewChange = (crewId) => {
    const crew = crews.find((c) => c.id === crewId);
    const rate = crew?.hourlyRate || 0;
    
    setTimeForm({
      ...timeForm,
      crewId: crewId,
      hourlyRate: rate,
      laborCost: (parseFloat(timeForm.hoursWorked) || 0) * rate,
    });
  };

  // Calculate labor cost when hours change
  const handleHoursChange = (hours) => {
    const hoursNum = parseFloat(hours) || 0;
    const rate = parseFloat(timeForm.hourlyRate) || 0;
    
    setTimeForm({
      ...timeForm,
      hoursWorked: hours,
      laborCost: hoursNum * rate,
    });
  };

  // Submit time entry
  const handleSubmitTime = async () => {
    if (!timeForm.crewId || !timeForm.hoursWorked) {
      Swal.fire("Missing Info", "Please select crew member and enter hours", "warning");
      return;
    }

    try {
      const crew = crews.find((c) => c.id === timeForm.crewId);
      
      const timeEntry = {
        jobId: selectedJob.id,
        jobName: selectedJob.clientName,
        crewId: timeForm.crewId,
        crewName: crew.name,
        workDate: timeForm.workDate,
        hoursWorked: parseFloat(timeForm.hoursWorked),
        hourlyRate: parseFloat(timeForm.hourlyRate),
        laborCost: parseFloat(timeForm.laborCost),
        notes: timeForm.notes,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "job_time_entries"), timeEntry);

      Swal.fire({
        icon: "success",
        title: "Time Logged!",
        text: `${timeForm.hoursWorked} hours logged for ${crew.name}`,
        timer: 2000,
        showConfirmButton: false,
      });

      setTimeDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error logging time:", error);
      Swal.fire("Error", "Failed to log time", "error");
    }
  };

  // Delete time entry
  const handleDeleteTime = async (entryId) => {
    const confirm = await Swal.fire({
      title: "Delete Time Entry?",
      text: "This cannot be undone",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      confirmButtonColor: "#d33",
    });

    if (confirm.isConfirmed) {
      try {
        await deleteDoc(doc(db, "job_time_entries", entryId));
        setTimeEntries(timeEntries.filter((t) => t.id !== entryId));
        Swal.fire("Deleted!", "Time entry removed", "success");
      } catch (error) {
        console.error("Error deleting time:", error);
        Swal.fire("Error", "Failed to delete time entry", "error");
      }
    }
  };

  // Calculate overall stats
  const totalRevenue = jobs.reduce((sum, job) => sum + (parseFloat(job.amount) || 0), 0);
  const totalLaborCost = timeEntries.reduce((sum, entry) => sum + (parseFloat(entry.laborCost) || 0), 0);
  const totalProfit = totalRevenue - totalLaborCost;
  const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <Typography>Loading job tracking...</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 3, mb: 6, px: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" }, mb: 3 }}>
        📊 Job Time & Profit Tracking
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Total Revenue
            </Typography>
            <Typography variant="h5" color="success.main" sx={{ fontWeight: 700 }}>
              ${totalRevenue.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Total Labor Cost
            </Typography>
            <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>
              ${totalLaborCost.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Total Profit
            </Typography>
            <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>
              ${totalProfit.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Profit Margin
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {overallMargin}%
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Jobs List with Time Tracking */}
      {jobs.length === 0 ? (
        <Alert severity="info">
          No jobs found. Jobs will appear here once created.
        </Alert>
      ) : (
        jobs.map((job) => {
          const timeEntries = getJobTimeEntries(job.id);
          const laborCost = getJobLaborCost(job.id);
          const totalHours = getJobTotalHours(job.id);
          const profit = getJobProfit(job);
          const margin = getProfitMargin(job);
          const revenue = parseFloat(job.amount) || 0;

          return (
            <Accordion key={job.id} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", pr: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                      {job.clientName || "Unnamed Job"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {job.description || "No description"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Chip
                      icon={<AccessTimeIcon />}
                      label={`${totalHours.toFixed(1)}h`}
                      size="small"
                      color="primary"
                    />
                    <Chip
                      icon={<AttachMoneyIcon />}
                      label={`${margin}%`}
                      size="small"
                      color={parseFloat(margin) > 30 ? "success" : parseFloat(margin) > 15 ? "warning" : "error"}
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              
              <AccordionDetails>
                {/* Job Financials */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: "#f5f5f5" }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Revenue
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        ${revenue.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Labor Cost
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        ${laborCost.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Materials Cost
                      </Typography>
                      <Typography variant="h6">
                        ${(job.materialsCost || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Profit
                      </Typography>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 700,
                          color: profit > 0 ? "success.main" : "error.main"
                        }}
                      >
                        ${profit.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Add Time Button */}
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenTimeDialog(job)}
                    size="small"
                  >
                    Log Hours
                  </Button>
                </Box>

                {/* Time Entries Table */}
                {timeEntries.length === 0 ? (
                  <Alert severity="info">No time entries yet. Click "Log Hours" to add crew hours.</Alert>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Crew Member</TableCell>
                          <TableCell>Hours</TableCell>
                          <TableCell>Rate</TableCell>
                          <TableCell>Cost</TableCell>
                          <TableCell>Notes</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timeEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {new Date(entry.workDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{entry.crewName}</TableCell>
                            <TableCell>{entry.hoursWorked}h</TableCell>
                            <TableCell>${entry.hourlyRate}/hr</TableCell>
                            <TableCell>
                              <strong>${entry.laborCost.toFixed(2)}</strong>
                            </TableCell>
                            <TableCell>{entry.notes || "—"}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteTime(entry.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      {/* Add Time Dialog */}
      <Dialog
        open={timeDialogOpen}
        onClose={() => setTimeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Log Hours - {selectedJob?.clientName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              select
              label="Crew Member *"
              value={timeForm.crewId}
              onChange={(e) => handleCrewChange(e.target.value)}
              fullWidth
              required
            >
              {crews.map((crew) => (
                <MenuItem key={crew.id} value={crew.id}>
                  {crew.name} - ${crew.hourlyRate || 0}/hr
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Work Date *"
              type="date"
              value={timeForm.workDate}
              onChange={(e) => setTimeForm({ ...timeForm, workDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <TextField
              label="Hours Worked *"
              type="number"
              value={timeForm.hoursWorked}
              onChange={(e) => handleHoursChange(e.target.value)}
              inputProps={{ min: 0, step: 0.5 }}
              fullWidth
              required
              helperText={timeForm.crewId ? `Rate: $${timeForm.hourlyRate}/hr` : "Select crew member first"}
            />

            {timeForm.laborCost > 0 && (
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Labor Cost:</strong> ${timeForm.laborCost.toFixed(2)}
                </Typography>
                <Typography variant="caption">
                  {timeForm.hoursWorked} hours × ${timeForm.hourlyRate}/hr
                </Typography>
              </Alert>
            )}

            <TextField
              label="Hourly Rate"
              type="number"
              value={timeForm.hourlyRate}
              onChange={(e) => setTimeForm({ ...timeForm, hourlyRate: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
              fullWidth
              helperText="Auto-filled from crew rate, but you can adjust"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                endAdornment: <Typography sx={{ ml: 1 }}>/hr</Typography>,
              }}
            />

            <TextField
              label="Notes"
              multiline
              rows={2}
              value={timeForm.notes}
              onChange={(e) => setTimeForm({ ...timeForm, notes: e.target.value })}
              placeholder="Task details, overtime, etc..."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTimeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitTime}
            disabled={!timeForm.crewId || !timeForm.hoursWorked}
          >
            Log Hours
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}