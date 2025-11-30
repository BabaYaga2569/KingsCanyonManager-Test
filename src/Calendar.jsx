import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import TodayIcon from "@mui/icons-material/Today";
import AddIcon from "@mui/icons-material/Add";
import PhoneIcon from "@mui/icons-material/Phone";
import NavigationIcon from "@mui/icons-material/Navigation";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function Calendar() {
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // month, week, day
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const snap = await getDocs(collection(db, "appointments"));
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAppointments(data);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return appointments.filter((apt) => {
      const aptDate = apt.scheduledDate || "";
      return aptDate.startsWith(dateStr);
    });
  };

  const handleAppointmentClick = (apt) => {
    setSelectedAppointment(apt);
    setDetailsOpen(true);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedAppointment) return;
    try {
      await updateDoc(doc(db, "appointments", selectedAppointment.id), {
        status: newStatus,
      });
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === selectedAppointment.id ? { ...apt, status: newStatus } : apt
        )
      );
      setSelectedAppointment({ ...selectedAppointment, status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedAppointment) return;
    if (window.confirm("Delete this appointment?")) {
      try {
        await deleteDoc(doc(db, "appointments", selectedAppointment.id));
        setAppointments((prev) =>
          prev.filter((apt) => apt.id !== selectedAppointment.id)
        );
        setDetailsOpen(false);
      } catch (error) {
        console.error("Error deleting appointment:", error);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "success";
      case "in progress":
        return "info";
      case "scheduled":
        return "primary";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  // Month view
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return (
      <Grid container spacing={1} sx={{ mt: 2 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Grid item xs={12 / 7} key={day}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", textAlign: "center" }}
            >
              {day}
            </Typography>
          </Grid>
        ))}
        {days.map((date, index) => {
          if (!date) {
            return <Grid item xs={12 / 7} key={`empty-${index}`}></Grid>;
          }

          const dayAppointments = getAppointmentsForDate(date);
          const isToday =
            date.toDateString() === new Date().toDateString();

          return (
            <Grid item xs={12 / 7} key={index}>
              <Card
                sx={{
                  minHeight: { xs: 60, md: 100 },
                  backgroundColor: isToday ? "#e3f2fd" : "white",
                  border: isToday ? "2px solid #1976d2" : "1px solid #ddd",
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "#f5f5f5",
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 0.5, md: 1 }, "&:last-child": { pb: { xs: 0.5, md: 1 } } }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isToday ? 700 : 400,
                      mb: 0.5,
                      fontSize: { xs: "0.7rem", md: "0.875rem" },
                    }}
                  >
                    {date.getDate()}
                  </Typography>
                  <Box>
                    {dayAppointments.slice(0, isMobile ? 1 : 3).map((apt) => (
                      <Chip
                        key={apt.id}
                        label={apt.customerName}
                        size="small"
                        color={getStatusColor(apt.status)}
                        onClick={() => handleAppointmentClick(apt)}
                        sx={{
                          fontSize: { xs: "0.6rem", md: "0.7rem" },
                          height: { xs: 16, md: 20 },
                          mb: 0.25,
                          maxWidth: "100%",
                        }}
                      />
                    ))}
                    {dayAppointments.length > (isMobile ? 1 : 3) && (
                      <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                        +{dayAppointments.length - (isMobile ? 1 : 3)} more
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  // Today view (simple list)
  const renderTodayView = () => {
    const today = new Date();
    const todayAppointments = getAppointmentsForDate(today);

    if (todayAppointments.length === 0) {
      return (
        <Box sx={{ textAlign: "center", mt: 4, p: 3 }}>
          <Typography variant="h6" color="text.secondary">
            No appointments scheduled for today
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/schedule-job")}
            sx={{ mt: 2 }}
          >
            Schedule a Job
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        {todayAppointments.map((apt) => (
          <Card key={apt.id} sx={{ mb: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="h6">{apt.customerName}</Typography>
                <Chip
                  label={apt.status || "Scheduled"}
                  color={getStatusColor(apt.status)}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                ⏰ {apt.startTime} • {apt.duration || 120} min
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {apt.description}
              </Typography>
              <Typography variant="h6" color="primary">
                ${apt.amount}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<NavigationIcon />}
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        apt.customerAddress || apt.customerName
                      )}`
                    )
                  }
                >
                  Navigate
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhoneIcon />}
                  onClick={() => window.open(`tel:${apt.customerPhone}`)}
                >
                  Call
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    setSelectedAppointment(apt);
                    handleStatusChange("Completed");
                  }}
                >
                  Complete
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          📅 Schedule
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/schedule-job")}
          size={isMobile ? "small" : "medium"}
        >
          Schedule Job
        </Button>
      </Box>

      {/* View Toggle */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Button
          variant={view === "month" ? "contained" : "outlined"}
          onClick={() => setView("month")}
          size="small"
        >
          Month
        </Button>
        <Button
          variant={view === "day" ? "contained" : "outlined"}
          onClick={() => setView("day")}
          size="small"
        >
          Today
        </Button>
      </Box>

      {/* Navigation */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <IconButton onClick={handlePrevious}>
          <NavigateBeforeIcon />
        </IconButton>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
            {view === "day" ? "Today" : monthName}
          </Typography>
          <IconButton onClick={handleToday} size="small">
            <TodayIcon />
          </IconButton>
        </Box>
        <IconButton onClick={handleNext}>
          <NavigateNextIcon />
        </IconButton>
      </Box>

      {/* Calendar View */}
      {view === "month" && renderMonthView()}
      {view === "day" && renderTodayView()}

      {/* Appointment Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedAppointment && (
          <>
            <DialogTitle>
              {selectedAppointment.customerName}
              <IconButton
                onClick={() => {
                  setDetailsOpen(false);
                  navigate(`/contract/${selectedAppointment.contractId}`);
                }}
                sx={{ float: "right" }}
                size="small"
              >
                <EditIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={selectedAppointment.status || "Scheduled"}
                  color={getStatusColor(selectedAppointment.status)}
                  sx={{ mb: 2 }}
                />
              </Box>

              <Typography variant="body1" sx={{ mb: 1 }}>
                📅 {selectedAppointment.scheduledDate}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                ⏰ {selectedAppointment.startTime} • {selectedAppointment.duration || 120} min
              </Typography>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                💰 ${selectedAppointment.amount}
              </Typography>

              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedAppointment.description}
              </Typography>

              {selectedAppointment.materials && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Materials: {selectedAppointment.materials}
                </Typography>
              )}

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<NavigationIcon />}
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        selectedAppointment.customerAddress ||
                          selectedAppointment.customerName
                      )}`
                    )
                  }
                >
                  Navigate
                </Button>
                {selectedAppointment.customerPhone && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhoneIcon />}
                    onClick={() =>
                      window.open(`tel:${selectedAppointment.customerPhone}`)
                    }
                  >
                    Call
                  </Button>
                )}
              </Box>

              <TextField
                select
                fullWidth
                label="Update Status"
                value={selectedAppointment.status || "Scheduled"}
                onChange={(e) => handleStatusChange(e.target.value)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="Scheduled">Scheduled</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </TextField>

              {selectedAppointment.contractId && (
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate(`/contract/${selectedAppointment.contractId}`)}
                  sx={{ mb: 1 }}
                >
                  View Contract
                </Button>
              )}
              {selectedAppointment.invoiceId && (
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate(`/invoice/${selectedAppointment.invoiceId}`)}
                >
                  View Invoice
                </Button>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDelete} color="error" startIcon={<DeleteIcon />}>
                Delete
              </Button>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}