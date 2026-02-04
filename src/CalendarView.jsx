import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate } from "react-router-dom";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Swal from "sweetalert2";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import RefreshIcon from "@mui/icons-material/Refresh";

const localizer = momentLocalizer(moment);

export default function CalendarView() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState([]);
  const [crews, setCrews] = useState([]);
  const [employees, setEmployees] = useState([]); // New: for employee assignment
  const [editingEmployees, setEditingEmployees] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calendarView, setCalendarView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date()); // For calendar navigation
  const [loading, setLoading] = useState(false);
  
  // Completion notes dialog
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "",
    jobDescription: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    priority: "normal",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  // FIXED: Reload data when window regains focus (user comes back from editing)
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load schedules
      const schedulesSnap = await getDocs(collection(db, "schedules"));
      const schedulesData = schedulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchedules(schedulesData);

      // Load crews
      const crewsSnap = await getDocs(collection(db, "crews"));
      const crewsData = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      // Load equipment
      const equipSnap = await getDocs(collection(db, "equipment"));
      const equipData = equipSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(equipData);

      // Load employees (active users)
      const usersSnap = await getDocs(collection(db, "users"));
      const activeEmployees = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((user) => user.active !== false);
      setEmployees(activeEmployees);
      console.log("✅ Loaded employees:", activeEmployees.length);

      // Convert schedules to calendar events
      const calendarEvents = schedulesData.map((schedule) => {
        const startDateTime = new Date(`${schedule.startDate}T${schedule.startTime || "08:00"}`);
        const endDateTime = schedule.endDate
          ? new Date(`${schedule.endDate}T${schedule.endTime || "17:00"}`)
          : new Date(`${schedule.startDate}T${schedule.endTime || "17:00"}`);

        return {
          id: schedule.id,
          title: schedule.clientName || "Untitled Job",
          start: startDateTime,
          end: endDateTime,
          resource: schedule,
        };
      });

      setEvents(calendarEvents);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
    setDetailsOpen(true);
  };

  const handleSelectSlot = ({ start }) => {
    const dateStr = moment(start).format("YYYY-MM-DD");
    navigate(`/schedule-job?date=${dateStr}`);
  };

  const handleDelete = async (schedule) => {
    const result = await Swal.fire({
      title: "Delete Schedule?",
      text: `Remove ${schedule.clientName}'s scheduled job?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "schedules", schedule.id));

        // Free up equipment
        for (const equipId of schedule.selectedEquipment || []) {
          await updateDoc(doc(db, "equipment", equipId), { status: "available" });
        }

        setDetailsOpen(false);
        loadData(); // Reload calendar
        Swal.fire("Deleted!", "Schedule removed", "success");
      } catch (error) {
        console.error("Error deleting schedule:", error);
        Swal.fire("Error", "Failed to delete schedule", "error");
      }
    }
  };

  const handleComplete = (schedule) => {
    // Open completion notes dialog
    setCompletionNotes("");
    setCompletionDialogOpen(true);
  };
  
  const handleSaveCompletion = async () => {
    try {
      const updates = {
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      
      // Add completion notes if provided
      if (completionNotes.trim()) {
        const existingNotes = selectedEvent.notes || "";
        updates.completionNotes = completionNotes;
        // Append to existing notes
        updates.notes = existingNotes 
          ? `${existingNotes}\n\n[Completion Notes - ${moment().format("MM/DD/YYYY")}]\n${completionNotes}`
          : `[Completion Notes - ${moment().format("MM/DD/YYYY")}]\n${completionNotes}`;
      }
      
      await updateDoc(doc(db, "schedules", selectedEvent.id), updates);

      // Free up equipment
      for (const equipId of selectedEvent.selectedEquipment || []) {
        await updateDoc(doc(db, "equipment", equipId), { status: "available" });
      }

      setCompletionDialogOpen(false);
      setDetailsOpen(false);
      loadData(); // Reload calendar
      Swal.fire("Completed!", "Job marked as completed", "success");
    } catch (error) {
      console.error("Error completing job:", error);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };
  
  const handleOpenEditDialog = (schedule) => {
    setEditForm({
      clientName: schedule.clientName || "",
      jobDescription: schedule.jobDescription || "",
      startDate: schedule.startDate || "",
      endDate: schedule.endDate || schedule.startDate || "",
      startTime: schedule.startTime || "08:00",
      endTime: schedule.endTime || "17:00",
      priority: schedule.priority || "normal",
      status: schedule.status || "scheduled",
      notes: schedule.notes || "",
    });
    setEditDialogOpen(true);
  };
  
  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, "schedules", selectedEvent.id), {
        clientName: editForm.clientName,
        jobDescription: editForm.jobDescription,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        priority: editForm.priority,
        status: editForm.status,
        notes: editForm.notes,
        updatedAt: new Date().toISOString(),
      });

      setEditDialogOpen(false);
      setDetailsOpen(false);
      loadData(); // Reload calendar
      Swal.fire("Success!", "Job updated successfully", "success");
    } catch (error) {
      console.error("Error updating job:", error);
      Swal.fire("Error", "Failed to update job", "error");
    }
  };

  const getCrewNames = (crewIds) => {
    if (!crewIds || crewIds.length === 0) return "No crew assigned";
    return crewIds
      .map((id) => crews.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const getEquipmentNames = (equipIds) => {
    if (!equipIds || equipIds.length === 0) return "No equipment";
    return equipIds
      .map((id) => equipment.find((e) => e.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent": return "error";
      case "high": return "warning";
      case "normal": return "info";
      case "low": return "default";
      default: return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "success";
      case "in-progress": return "warning";
      case "scheduled": return "info";
      default: return "default";
    }
  };

  // Custom event styling
  const eventStyleGetter = (event) => {
    const schedule = event.resource;
    let backgroundColor = "#3174ad"; // default blue

    if (schedule.status === "completed") {
      backgroundColor = "#4caf50"; // green
    } else if (schedule.priority === "urgent") {
      backgroundColor = "#f44336"; // red
    } else if (schedule.priority === "high") {
      backgroundColor = "#ff9800"; // orange
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "5px",
        opacity: 0.8,
        color: "white",
        border: "0px",
        display: "block",
      },
    };
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 6 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          Calendar View
        </Typography>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {/* ADDED: Refresh button */}
          <Button
            variant="outlined"
            size="small"
            onClick={loadData}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            {loading ? "..." : "Refresh"}
          </Button>

          {!isMobile && (
            <ToggleButtonGroup
              value={calendarView}
              exclusive
              onChange={(e, newView) => newView && setCalendarView(newView)}
              size="small"
            >
              <ToggleButton value="month">
                <CalendarViewMonthIcon sx={{ mr: 0.5 }} />
                Month
              </ToggleButton>
              <ToggleButton value="week">
                <ViewWeekIcon sx={{ mr: 0.5 }} />
                Week
              </ToggleButton>
              <ToggleButton value="day">
                <ViewDayIcon sx={{ mr: 0.5 }} />
                Day
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/schedule-dashboard")}
          >
            List View
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/schedule-job")}
            size="small"
          >
            {isMobile ? "Add" : "Add Job"}
          </Button>
        </Box>
      </Box>

      {/* Color Legend */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Chip label="Urgent" size="small" sx={{ bgcolor: "#f44336", color: "white" }} />
        <Chip label="High Priority" size="small" sx={{ bgcolor: "#ff9800", color: "white" }} />
        <Chip label="Normal" size="small" sx={{ bgcolor: "#3174ad", color: "white" }} />
        <Chip label="Completed" size="small" sx={{ bgcolor: "#4caf50", color: "white" }} />
      </Box>

      {/* Calendar */}
      <Box
        sx={{
          bgcolor: "white",
          p: { xs: 1, sm: 2 },
          borderRadius: 2,
          boxShadow: 2,
          "& .rbc-calendar": {
            minHeight: isMobile ? "400px" : "600px",
          },
          "& .rbc-event": {
            fontSize: isMobile ? "0.7rem" : "0.875rem",
          },
          "& .rbc-toolbar button": {
            fontSize: isMobile ? "0.8rem" : "1rem",
          },
        }}
      >
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: isMobile ? 400 : 600 }}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          view={calendarView}
          onView={setCalendarView}
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          eventPropGetter={eventStyleGetter}
          views={["month", "week", "day"]}
          popup
        />
      </Box>

      {/* Event Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h6">Job Details</Typography>
                <Box>
                  <Chip
                    label={selectedEvent.status || "scheduled"}
                    color={getStatusColor(selectedEvent.status)}
                    size="small"
                  />
                  {selectedEvent.priority && selectedEvent.priority !== "normal" && (
                    <Chip
                      label={selectedEvent.priority}
                      color={getPriorityColor(selectedEvent.priority)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Client
                  </Typography>
                  <Typography variant="h6">{selectedEvent.clientName}</Typography>
                </Box>

                {selectedEvent.jobDescription && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Job Description
                    </Typography>
                    <Typography variant="body1">{selectedEvent.jobDescription}</Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Schedule
                  </Typography>
                  <Typography variant="body1">
                    📅 {moment(selectedEvent.startDate).format("MMM DD, YYYY")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ⏰ {selectedEvent.startTime} - {selectedEvent.endTime}
                  </Typography>
                  {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && (
                    <Typography variant="body2" color="text.secondary">
                      Ends: {moment(selectedEvent.endDate).format("MMM DD, YYYY")}
                    </Typography>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    👷 Assigned Employees
                  </Typography>
                  {!editingEmployees ? (
                    <>
                      {selectedEvent.assignedEmployees && selectedEvent.assignedEmployees.length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                          {selectedEvent.assignedEmployees.map((empId) => {
                            const emp = employees.find((e) => e.id === empId);
                            return emp ? (
                              <Chip
                                key={empId}
                                label={emp.name || emp.email}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ) : null;
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No employees assigned
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingEmployees(true);
                          setSelectedEmployeeIds(selectedEvent.assignedEmployees || []);
                        }}
                        sx={{ mt: 1 }}
                      >
                        Edit Employees
                      </Button>
                    </>
                  ) : (
                    <>
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Select Employees</InputLabel>
                        <Select
                          multiple
                          value={selectedEmployeeIds}
                          onChange={(e) => setSelectedEmployeeIds(e.target.value)}
                          renderValue={(selected) => (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {selected.map((empId) => {
                                const emp = employees.find((e) => e.id === empId);
                                return (
                                  <Chip
                                    key={empId}
                                    label={emp?.name || emp?.email || empId}
                                    size="small"
                                  />
                                );
                              })}
                            </Box>
                          )}
                        >
                          {employees.map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                              <Checkbox checked={selectedEmployeeIds.indexOf(emp.id) > -1} />
                              <ListItemText primary={emp.name || emp.email} />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, "schedules", selectedEvent.id), {
                                assignedEmployees: selectedEmployeeIds,
                              });
                              setSelectedEvent({
                                ...selectedEvent,
                                assignedEmployees: selectedEmployeeIds,
                              });
                              setEditingEmployees(false);
                              await loadData();
                              Swal.fire("Success!", "Employees updated successfully", "success");
                            } catch (error) {
                              console.error("Error updating employees:", error);
                              Swal.fire("Error", "Failed to update employees", "error");
                            }
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setEditingEmployees(false);
                            setSelectedEmployeeIds(selectedEvent.assignedEmployees || []);
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    🚛 Equipment
                  </Typography>
                  <Typography variant="body1">
                    {getEquipmentNames(selectedEvent.selectedEquipment)}
                  </Typography>
                </Box>

                {selectedEvent.notes && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      📝 Notes
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                      {selectedEvent.notes}
                    </Typography>
                  </Box>
                )}
                
                {selectedEvent.completionNotes && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      ✅ Completion Notes
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                      {selectedEvent.completionNotes}
                    </Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleOpenEditDialog(selectedEvent)}
                fullWidth={isMobile}
              >
                Edit Job
              </Button>
              {selectedEvent.contractId && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setDetailsOpen(false);
                    navigate(`/contract/${selectedEvent.contractId}`);
                  }}
                  fullWidth={isMobile}
                >
                  View Contract
                </Button>
              )}
              {selectedEvent.status !== "completed" && (
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleComplete(selectedEvent)}
                  fullWidth={isMobile}
                >
                  Mark Complete
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => handleDelete(selectedEvent)}
                fullWidth={isMobile}
              >
                Delete
              </Button>
              <Button onClick={() => setDetailsOpen(false)} fullWidth={isMobile}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Completion Notes Dialog */}
      <Dialog
        open={completionDialogOpen}
        onClose={() => setCompletionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Complete Job</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add notes about what was completed, any issues encountered, or additional work done.
          </Typography>
          <TextField
            label="Completion Notes"
            multiline
            rows={4}
            fullWidth
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            placeholder="Example: Completed weed spraying. Applied pre-emergent herbicide to all areas. Some areas needed extra attention due to heavy weed growth."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveCompletion} variant="contained" color="success">
            Mark Complete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Job Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Edit Job</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Client Name"
              fullWidth
              value={editForm.clientName}
              onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
            />
            
            <TextField
              label="Job Description"
              fullWidth
              multiline
              rows={3}
              value={editForm.jobDescription}
              onChange={(e) => setEditForm({ ...editForm, jobDescription: e.target.value })}
            />
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                label="Start Date"
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: "200px" }}
              />
              
              <TextField
                label="End Date"
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: "200px" }}
              />
            </Box>
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                label="Start Time"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: "150px" }}
              />
              
              <TextField
                label="End Time"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: "150px" }}
              />
            </Box>
            
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}