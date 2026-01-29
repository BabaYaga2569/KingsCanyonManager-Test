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
  const [employees, setEmployees] = useState([]); // ✅ FIXED: Changed from crews
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calendarView, setCalendarView] = useState("month");
  const [loading, setLoading] = useState(false);

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

      // ✅ FIXED: Load employees from users collection (not crews)
      const employeesSnap = await getDocs(collection(db, "users"));
      const employeesData = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmployees(employeesData.filter((e) => e.active !== false));

      // Load equipment
      const equipSnap = await getDocs(collection(db, "equipment"));
      const equipData = equipSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(equipData);

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

  const handleComplete = async (schedule) => {
    try {
      await updateDoc(doc(db, "schedules", schedule.id), { status: "completed" });

      // Free up equipment
      for (const equipId of schedule.selectedEquipment || []) {
        await updateDoc(doc(db, "equipment", equipId), { status: "available" });
      }

      setDetailsOpen(false);
      loadData(); // Reload calendar
      Swal.fire("Completed!", "Job marked as completed", "success");
    } catch (error) {
      console.error("Error completing job:", error);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  // ✅ FIXED: Get employee names (not crew names)
  const getEmployeeNames = (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return "No employees assigned";
    return employeeIds
      .map((id) => employees.find((e) => e.id === id)?.name)
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
          📅 Calendar View
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
        <Chip label="🔴 Urgent" size="small" sx={{ bgcolor: "#f44336", color: "white" }} />
        <Chip label="🟠 High Priority" size="small" sx={{ bgcolor: "#ff9800", color: "white" }} />
        <Chip label="🔵 Normal" size="small" sx={{ bgcolor: "#3174ad", color: "white" }} />
        <Chip label="🟢 Completed" size="small" sx={{ bgcolor: "#4caf50", color: "white" }} />
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
                  <Typography variant="subtitle2" color="text.secondary">
                    👥 Assigned Employees
                  </Typography>
                  <Typography variant="body1">
                    {getEmployeeNames(selectedEvent.selectedEmployees || selectedEvent.selectedCrews)}
                  </Typography>
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
                    <Typography variant="body1">{selectedEvent.notes}</Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
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
    </Container>
  );
}