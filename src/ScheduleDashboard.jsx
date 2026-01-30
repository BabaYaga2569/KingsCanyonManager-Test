import React, { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Swal from "sweetalert2";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { markAsViewed } from './useNotificationCounts';

export default function ScheduleDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState([]);
  const [crews, setCrews] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    markAsViewed('schedule');
  }, []);

  const loadData = async () => {
    try {
      const schedulesSnap = await getDocs(collection(db, "schedules"));
      const schedulesData = schedulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchedules(schedulesData);

      const crewsSnap = await getDocs(collection(db, "crews"));
      const crewsData = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(crewsData);

      const equipSnap = await getDocs(collection(db, "equipment"));
      const equipData = equipSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(equipData);
    } catch (error) {
      console.error("Error loading schedule data:", error);
    }
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

        setSchedules(schedules.filter((s) => s.id !== schedule.id));
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

      setSchedules(schedules.map((s) => 
        s.id === schedule.id ? { ...s, status: "completed" } : s
      ));
      
      Swal.fire("Completed!", "Job marked as completed", "success");
    } catch (error) {
      console.error("Error completing job:", error);
      Swal.fire("Error", "Failed to update status", "error");
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

  const groupSchedulesByDate = () => {
    const grouped = {};
    
    // Filter schedules to only include those in the current month
    const currentYear = currentMonth.getFullYear();
    const currentMonthNum = currentMonth.getMonth();
    
    schedules.forEach((schedule) => {
      const scheduleDate = new Date(schedule.startDate + 'T00:00:00');
      const scheduleYear = scheduleDate.getFullYear();
      const scheduleMonthNum = scheduleDate.getMonth();
      
      // Only include schedules from the current displayed month
      if (scheduleYear === currentYear && scheduleMonthNum === currentMonthNum) {
        const date = schedule.startDate;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(schedule);
      }
    });
    return grouped;
  };

  const sortedDates = Object.keys(groupSchedulesByDate()).sort();

  const handleViewDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setDetailsOpen(true);
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          Schedule Dashboard
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/crew-manager")}
          >
            {isMobile ? "Crew" : "Manage Crew"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/equipment-manager")}
          >
            {isMobile ? "Equipment" : "Manage Equipment"}
          </Button>
        </Box>
      </Box>

      {schedules.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <CalendarTodayIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Scheduled Jobs Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Schedule jobs from the Contracts page
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/contracts")}
          >
            Go to Contracts
          </Button>
        </Box>
      ) : (
        <>
          {/* Month Navigation */}
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mb: 3, gap: 2 }}>
            <IconButton onClick={handlePreviousMonth}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Typography>
            <IconButton onClick={handleNextMonth}>
              <ArrowForwardIcon />
            </IconButton>
          </Box>

          {/* Grouped by Date */}
          {sortedDates.length === 0 ? (
            <Alert severity="info">No scheduled jobs for the selected period</Alert>
          ) : (
            sortedDates.map((date) => (
              <Box key={date} sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                  {formatDate(date)}
                </Typography>
                <Grid container spacing={2}>
                  {groupSchedulesByDate()[date].map((schedule) => (
                    <Grid item xs={12} md={6} key={schedule.id}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                              {schedule.clientName}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Chip
                                label={schedule.status || "scheduled"}
                                color={getStatusColor(schedule.status)}
                                size="small"
                              />
                              {schedule.priority && schedule.priority !== "normal" && (
                                <Chip
                                  label={schedule.priority}
                                  color={getPriorityColor(schedule.priority)}
                                  size="small"
                                />
                              )}
                            </Box>
                          </Box>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            â° {schedule.startTime} - {schedule.endTime}
                          </Typography>

                          {schedule.jobDescription && (
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              {schedule.jobDescription}
                            </Typography>
                          )}

                          <Divider sx={{ my: 1 }} />

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            <strong>Crew:</strong> {getCrewNames(schedule.selectedCrews)}
                          </Typography>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Equipment:</strong> {getEquipmentNames(schedule.selectedEquipment)}
                          </Typography>

                          {schedule.notes && (
                            <Typography variant="body2" sx={{ mt: 2, fontStyle: "italic", color: "text.secondary" }}>
                              {schedule.notes}
                            </Typography>
                          )}

                          <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<InfoIcon />}
                              onClick={() => handleViewDetails(schedule)}
                            >
                              Details
                            </Button>
                            {schedule.status !== "completed" && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleComplete(schedule)}
                              >
                                Complete
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(schedule)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))
          )}
        </>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        {selectedSchedule && (
          <>
            <DialogTitle>
              Job Schedule Details
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Client
                  </Typography>
                  <Typography variant="body1">{selectedSchedule.clientName}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Job Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedSchedule.jobDescription || "No description"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Schedule
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedSchedule.startDate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSchedule.startTime} - {selectedSchedule.endTime}
                  </Typography>
                  {selectedSchedule.endDate && selectedSchedule.endDate !== selectedSchedule.startDate && (
                    <Typography variant="body2" color="text.secondary">
                      Ends: {formatDate(selectedSchedule.endDate)}
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Assigned Crew
                  </Typography>
                  <Typography variant="body1">
                    {getCrewNames(selectedSchedule.selectedCrews)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Equipment
                  </Typography>
                  <Typography variant="body1">
                    {getEquipmentNames(selectedSchedule.selectedEquipment)}
                  </Typography>
                </Box>

                {selectedSchedule.notes && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Notes
                    </Typography>
                    <Typography variant="body1">{selectedSchedule.notes}</Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedSchedule.status || "scheduled"}
                    color={getStatusColor(selectedSchedule.status)}
                    size="small"
                  />
                  {selectedSchedule.priority && (
                    <Chip
                      label={selectedSchedule.priority}
                      color={getPriorityColor(selectedSchedule.priority)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>

                {selectedSchedule.contractId && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setDetailsOpen(false);
                      navigate(`/contract/${selectedSchedule.contractId}`);
                    }}
                  >
                    View Contract
                  </Button>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}