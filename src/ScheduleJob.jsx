import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  TextField,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import Swal from "sweetalert2";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function ScheduleJob() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const contractId = searchParams.get("contractId");
  const dateParam = searchParams.get("date"); // NEW: Get date from calendar

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [allContracts, setAllContracts] = useState([]); // NEW: For manual selection
  const [selectedContractId, setSelectedContractId] = useState(contractId || ""); // NEW
  const [employees, setEmployees] = useState([]); // ✅ FIXED: Changed from crews
  const [equipment, setEquipment] = useState([]);
  
  const [formData, setFormData] = useState({
    startDate: dateParam || "", // NEW: Pre-fill date if coming from calendar
    startTime: "08:00",
    endDate: "",
    endTime: "17:00",
    selectedEmployees: [], // ✅ FIXED: Changed from selectedCrews
    selectedEquipment: [],
    notes: "",
    priority: "normal",
  });

  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    loadData();
  }, [contractId]);

  useEffect(() => {
    // Check if contract was passed via navigation state
    if (location.state?.contract) {
      setContract(location.state.contract);
      setSelectedContractId(location.state.contract.id);
    }
  }, [location.state]);

  const loadData = async () => {
    try {
      // Load ALL contracts for dropdown
      const contractsSnap = await getDocs(collection(db, "contracts"));
      const contractsData = contractsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAllContracts(contractsData.filter(c => c.status !== "Cancelled"));

      // Load specific contract if contractId provided
      if (contractId) {
        const contractDoc = await getDoc(doc(db, "contracts", contractId));
        if (contractDoc.exists()) {
          const contractData = { id: contractDoc.id, ...contractDoc.data() };
          setContract(contractData);
          setSelectedContractId(contractId);
        }
      }

      // ✅ FIXED: Load employees from users collection (not crews)
      const employeesSnap = await getDocs(collection(db, "users"));
      const employeesData = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Only show active employees
      setEmployees(employeesData.filter((e) => e.active !== false));

      // Load equipment
      const equipSnap = await getDocs(collection(db, "equipment"));
      const equipData = equipSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(equipData.filter((e) => e.status === "available"));

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire("Error", "Failed to load scheduling data", "error");
      setLoading(false);
    }
  };

  const checkConflicts = async () => {
    if (!formData.startDate) return;

    try {
      const schedulesSnap = await getDocs(collection(db, "schedules"));
      const existingSchedules = schedulesSnap.docs.map((d) => d.data());

      const newConflicts = [];

      // ✅ FIXED: Check employee conflicts (not crew)
      formData.selectedEmployees.forEach((employeeId) => {
        const employee = employees.find((e) => e.id === employeeId);
        const hasConflict = existingSchedules.some((s) => 
          s.selectedEmployees?.includes(employeeId) &&
          s.startDate === formData.startDate
        );
        if (hasConflict) {
          newConflicts.push(`${employee.name} is already scheduled on this date`);
        }
      });

      // Check equipment conflicts
      formData.selectedEquipment.forEach((equipId) => {
        const equip = equipment.find((e) => e.id === equipId);
        const hasConflict = existingSchedules.some((s) => 
          s.selectedEquipment?.includes(equipId) &&
          s.startDate === formData.startDate
        );
        if (hasConflict) {
          newConflicts.push(`${equip.name} is already reserved on this date`);
        }
      });

      setConflicts(newConflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    }
  };

  useEffect(() => {
    if (formData.startDate && (formData.selectedEmployees.length > 0 || formData.selectedEquipment.length > 0)) {
      checkConflicts();
    } else {
      setConflicts([]);
    }
  }, [formData.startDate, formData.selectedEmployees, formData.selectedEquipment]);

  const handleEmployeeToggle = (employeeId) => {
    setFormData((prev) => ({
      ...prev,
      selectedEmployees: prev.selectedEmployees.includes(employeeId)
        ? prev.selectedEmployees.filter((id) => id !== employeeId)
        : [...prev.selectedEmployees, employeeId],
    }));
  };

  const handleEquipmentToggle = (equipId) => {
    setFormData((prev) => ({
      ...prev,
      selectedEquipment: prev.selectedEquipment.includes(equipId)
        ? prev.selectedEquipment.filter((id) => id !== equipId)
        : [...prev.selectedEquipment, equipId],
    }));
  };

  const handleSchedule = async () => {
    if (!formData.startDate) {
      Swal.fire("Missing Info", "Please select a start date", "warning");
      return;
    }

    if (!contract) {
      Swal.fire("Missing Info", "Please select a client/contract", "warning");
      return;
    }

    if (conflicts.length > 0) {
      const result = await Swal.fire({
        title: "Scheduling Conflicts Detected",
        html: `<ul style="text-align:left">${conflicts.map((c) => `<li>${c}</li>`).join("")}</ul><p>Do you want to proceed anyway?</p>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Schedule Anyway",
        cancelButtonText: "Go Back",
      });
      if (!result.isConfirmed) return;
    }

    try {
      const scheduleData = {
        contractId: selectedContractId || null,
        clientName: contract?.clientName || "Unknown",
        jobDescription: contract?.description || "",
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate || formData.startDate,
        endTime: formData.endTime,
        selectedEmployees: formData.selectedEmployees, // ✅ FIXED: Changed from selectedCrews
        selectedEquipment: formData.selectedEquipment,
        notes: formData.notes,
        priority: formData.priority,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      };

      const scheduleRef = await addDoc(collection(db, "schedules"), scheduleData);

      // Update contract with schedule reference
      if (selectedContractId) {
        await updateDoc(doc(db, "contracts", selectedContractId), {
          scheduleId: scheduleRef.id,
          scheduledDate: formData.startDate,
        });
      }

      // Update equipment status
      for (const equipId of formData.selectedEquipment) {
        await updateDoc(doc(db, "equipment", equipId), { status: "in-use" });
      }

      Swal.fire({
        icon: "success",
        title: "Job Scheduled!",
        text: `${contract?.clientName}'s job has been scheduled for ${formData.startDate}`,
        confirmButtonText: "View Schedule",
      }).then(() => {
        navigate("/schedule-dashboard");
      });
    } catch (error) {
      console.error("Error scheduling job:", error);
      Swal.fire("Error", "Failed to schedule job. Please try again.", "error");
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading scheduling data...</Typography>
      </Container>
    );
  }

  if (!contract && contractId) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Contract not found</Alert>
        <Button onClick={() => navigate("/contracts")} sx={{ mt: 2 }}>
          Back to Contracts
        </Button>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/contracts")}
        sx={{ mb: 2 }}
      >
        Back to Contracts
      </Button>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <CalendarTodayIcon sx={{ fontSize: 40, color: "primary.main" }} />
          <Box>
            <Typography variant="h5">Schedule Job</Typography>
            {contract && (
              <Typography variant="body2" color="text.secondary">
                {contract.clientName} - {contract.description}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Show contract info if selected/passed */}
        {contract && (
          <Box sx={{ mb: 3, p: 2, bgcolor: "#e3f2fd", borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Client: {contract.clientName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {contract.description}
            </Typography>
          </Box>
        )}

        {/* Client Selection dropdown (only if no contract selected) */}
        {!contract && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Client / Contract *</InputLabel>
              <Select
                value={selectedContractId}
                label="Select Client / Contract *"
                onChange={(e) => {
                  const selected = allContracts.find(c => c.id === e.target.value);
                  setSelectedContractId(e.target.value);
                  setContract(selected);
                }}
                required
              >
                {allContracts.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.clientName} ({c.id.slice(0, 6)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Date & Time Selection */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Start Date *"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Start Time"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="End Date (Optional)"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Leave blank for single-day job"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="End Time"
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* ✅ FIXED: Employee Selection (not Crew) */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          👥 Assign Employees
        </Typography>
        {employees.length > 0 ? (
          <FormGroup>
            <Grid container spacing={1}>
              {employees.map((employee) => (
                <Grid item xs={12} sm={6} md={4} key={employee.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.selectedEmployees.includes(employee.id)}
                        onChange={() => handleEmployeeToggle(employee.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{employee.name}</Typography>
                        {employee.jobTitle && (
                          <Typography variant="caption" color="text.secondary">
                            {employee.jobTitle}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            No employees available.{" "}
            <Button size="small" onClick={() => navigate("/employees")}>
              Add Employees
            </Button>
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Equipment Selection */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          🚛 Reserve Equipment
        </Typography>
        {equipment.length > 0 ? (
          <FormGroup>
            <Grid container spacing={1}>
              {equipment.map((equip) => (
                <Grid item xs={12} sm={6} md={4} key={equip.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.selectedEquipment.includes(equip.id)}
                        onChange={() => handleEquipmentToggle(equip.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{equip.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {equip.type}
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            No equipment available.{" "}
            <Button size="small" onClick={() => navigate("/equipment-manager")}>
              Add Equipment
            </Button>
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Priority & Notes */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Schedule Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={4}
              placeholder="Special instructions, delivery times, access notes, etc."
              fullWidth
            />
          </Grid>
        </Grid>

        {/* Conflicts Warning */}
        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              ⚠️ Scheduling Conflicts:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {conflicts.map((conflict, idx) => (
                <li key={idx}>{conflict}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSchedule}
            disabled={!formData.startDate}
            fullWidth
          >
            Schedule Job
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/contracts")}
            sx={{ minWidth: 120 }}
          >
            Cancel
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}