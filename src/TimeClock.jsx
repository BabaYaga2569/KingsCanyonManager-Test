import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthProvider";
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  MenuItem,
  Card,
  CardContent,
  Chip,
  CircularProgress,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import moment from "moment";
import Swal from "sweetalert2";
import { notifyCrewClockIn, notifyCrewClockOut, notifyLunchStart, notifyLunchEnd } from './pushoverNotificationService';

export default function TimeClock() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [clockedIn, setClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  
  // 🍔 NEW: Lunch break state
  const [onLunch, setOnLunch] = useState(false);
  const [lunchStartTime, setLunchStartTime] = useState(null);
  const [totalLunchTime, setTotalLunchTime] = useState(0); // in seconds

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    let interval;
    if (clockedIn && currentEntry && !onLunch) {
      // Update elapsed time (excluding lunch)
      interval = setInterval(() => {
        const start = moment(currentEntry.clockIn);
        const now = moment();
        const totalSeconds = now.diff(start, 'seconds');
        setElapsedTime(totalSeconds - totalLunchTime);
      }, 1000);
    } else if (onLunch && lunchStartTime) {
      // Update lunch timer
      interval = setInterval(() => {
        const lunchStart = moment(lunchStartTime);
        const now = moment();
        const currentLunchSeconds = now.diff(lunchStart, 'seconds');
        // Update total lunch time (including current lunch session)
        setTotalLunchTime(currentEntry.lunchMinutes * 60 + currentLunchSeconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [clockedIn, currentEntry, onLunch, lunchStartTime, totalLunchTime]);

  const loadEmployeeInfo = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const employee = users.find(u => u.email === user.email);
      
      if (employee) {
        console.log("✅ Found employee:", employee.name);
        setEmployeeInfo(employee);
      } else {
        console.log("⚠️ No employee record for:", user.email);
        setEmployeeInfo({
          name: user.displayName || user.email,
          email: user.email,
        });
      }
    } catch (error) {
      console.error("Error loading employee info:", error);
      setEmployeeInfo({
        name: user.displayName || user.email,
        email: user.email,
      });
    }
  };

  const loadData = async () => {
    try {
      await loadEmployeeInfo();
      
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs.map((d) => {
        const data = d.data();
        const clientName = data.clientName || data.customerName || "Unknown Client";
        
        return { 
          id: d.id, 
          ...data,
          clientName: clientName,
          displayName: clientName
        };
      });
      
      setJobs(jobsData);
      await checkExistingEntry();
      await loadTodayHours();
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire("Error", "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkExistingEntry = async () => {
    try {
      const q = query(
        collection(db, "job_time_entries"),
        where("crewId", "==", user.uid),
        where("clockOut", "==", null),
        orderBy("clockIn", "desc")
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const entry = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCurrentEntry(entry);
        setClockedIn(true);
        setSelectedJob(entry.jobId);
        
        // 🍔 NEW: Restore lunch state if exists
        if (entry.lunchStartTime && !entry.lunchEndTime) {
          setOnLunch(true);
          setLunchStartTime(entry.lunchStartTime);
        }
        if (entry.lunchMinutes) {
          setTotalLunchTime(entry.lunchMinutes * 60);
        }
        
        const start = moment(entry.clockIn);
        const now = moment();
        const totalSeconds = now.diff(start, 'seconds');
        const lunchSeconds = entry.lunchMinutes ? entry.lunchMinutes * 60 : 0;
        setElapsedTime(totalSeconds - lunchSeconds);
      }
    } catch (error) {
      console.error("Error checking existing entry:", error);
    }
  };

  const loadTodayHours = async () => {
    try {
      const todayStart = moment().startOf('day').toISOString();
      const todayEnd = moment().endOf('day').toISOString();
      
      const timeEntriesRef = collection(db, "job_time_entries");
      const q = query(
        timeEntriesRef,
        where("crewId", "==", user.uid),
        where("clockIn", ">=", todayStart),
        where("clockIn", "<=", todayEnd)
      );
      
      const entriesSnap = await getDocs(q);
      let total = 0;
      
      entriesSnap.docs.forEach((doc) => {
        const entry = doc.data();
        if (entry.hoursWorked) {
          total += parseFloat(entry.hoursWorked);
        }
      });
      
      setTodayHours(total);
    } catch (error) {
      console.error("Error loading today's hours:", error);
    }
  };

  const handleClockIn = async () => {
    if (!selectedJob) {
      Swal.fire("Error", "Please select a job first", "warning");
      return;
    }

    try {
      const job = jobs.find(j => j.id === selectedJob);
      const now = new Date().toISOString();
      const employeeName = employeeInfo?.name || user.displayName || user.email;

      const entryData = {
        crewId: user.uid,
        crewName: employeeName,
        crewEmail: user.email,
        jobId: selectedJob,
        jobName: job?.displayName || "Unknown Job",
        jobDescription: job?.displayName || "No description",
        clockIn: now,
        clockOut: null,
        hoursWorked: null,
        // 🍔 NEW: Lunch tracking fields
        lunchStartTime: null,
        lunchEndTime: null,
        lunchMinutes: 0,
        status: "pending",
        createdAt: now,
      };

      console.log("✅ Clocking in as:", employeeName);

      const docRef = await addDoc(collection(db, "job_time_entries"), entryData);
      
      setCurrentEntry({ id: docRef.id, ...entryData });
      setClockedIn(true);
      setTotalLunchTime(0);

      try {
        await notifyCrewClockIn(employeeName, job?.displayName || "Unknown Job");
      } catch (smsError) {
        console.error('Error sending clock in notification:', smsError);
      }

      Swal.fire({
        icon: "success",
        title: "Clocked In!",
        text: `Started work on ${job?.displayName || "job"}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error clocking in:", error);
      Swal.fire("Error", "Failed to clock in", "error");
    }
  };

  // 🍔 NEW: Start lunch break
  const handleStartLunch = async () => {
    if (!currentEntry) return;

    try {
      const now = new Date().toISOString();
      
      await updateDoc(doc(db, "job_time_entries", currentEntry.id), {
        lunchStartTime: now,
        updatedAt: now,
      });

      setOnLunch(true);
      setLunchStartTime(now);
      setCurrentEntry({ ...currentEntry, lunchStartTime: now });

      // Notify admin via Pushover
      try {
        await notifyLunchStart(currentEntry.crewName || user.displayName || user.email, currentEntry.jobName || null);
      } catch (e) { console.error("Pushover lunch start error:", e); }

      Swal.fire({
        icon: "info",
        title: "Lunch Break Started",
        text: "Enjoy your meal! 🍔",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error starting lunch:", error);
      Swal.fire("Error", "Failed to start lunch break", "error");
    }
  };

  // 🍔 NEW: End lunch break
  const handleEndLunch = async () => {
    if (!currentEntry || !lunchStartTime) return;

    try {
      const now = new Date().toISOString();
      const lunchStart = moment(lunchStartTime);
      const lunchEnd = moment(now);
      const lunchMinutes = lunchEnd.diff(lunchStart, 'minutes');

      // Add to existing lunch time
      const totalLunchMinutes = (currentEntry.lunchMinutes || 0) + lunchMinutes;

      await updateDoc(doc(db, "job_time_entries", currentEntry.id), {
        lunchEndTime: now,
        lunchMinutes: totalLunchMinutes,
        updatedAt: now,
      });

      setOnLunch(false);
      setLunchStartTime(null);
      setTotalLunchTime(totalLunchMinutes * 60);
      setCurrentEntry({ 
        ...currentEntry, 
        lunchEndTime: now,
        lunchMinutes: totalLunchMinutes
      });

      // Notify admin via Pushover
      try {
        await notifyLunchEnd(currentEntry.crewName || user.displayName || user.email, lunchMinutes, currentEntry.jobName || null);
      } catch (e) { console.error("Pushover lunch end error:", e); }

      Swal.fire({
        icon: "success",
        title: "Back to Work!",
        text: `Lunch: ${lunchMinutes} minutes`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error ending lunch:", error);
      Swal.fire("Error", "Failed to end lunch break", "error");
    }
  };

  const handleClockOut = async () => {
    if (!currentEntry) return;

    try {
      const now = new Date().toISOString();
      const clockInTime = moment(currentEntry.clockIn);
      const clockOutTime = moment(now);
      const totalHours = clockOutTime.diff(clockInTime, 'hours', true);
      
      // 🍔 UPDATED: Subtract lunch time from total hours
      const lunchHours = (currentEntry.lunchMinutes || 0) / 60;
      const workedHours = totalHours - lunchHours;

      await updateDoc(doc(db, "job_time_entries", currentEntry.id), {
        clockOut: now,
        hoursWorked: parseFloat(workedHours.toFixed(2)),
        updatedAt: now,
      });

      setClockedIn(false);
      setCurrentEntry(null);
      setElapsedTime(0);
      setSelectedJob("");
      setOnLunch(false);
      setLunchStartTime(null);
      setTotalLunchTime(0);
      
      await loadTodayHours();

      try {
        const employeeName = currentEntry.crewName || user.displayName || user.email;
        await notifyCrewClockOut(employeeName, workedHours.toFixed(2));
      } catch (smsError) {
        console.error('Error sending clock out notification:', smsError);
      }

      Swal.fire({
        icon: "success",
        title: "Clocked Out!",
        html: `
          <p>Total time: <strong>${totalHours.toFixed(2)} hours</strong></p>
          ${currentEntry.lunchMinutes ? `<p>Lunch break: <strong>${currentEntry.lunchMinutes} minutes</strong></p>` : ''}
          <p>You worked: <strong>${workedHours.toFixed(2)} hours</strong></p>
          <p>Your time is pending approval</p>
        `,
        timer: 4000,
      });
    } catch (error) {
      console.error("Error clocking out:", error);
      Swal.fire("Error", "Failed to clock out", "error");
    }
  };

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 3, pb: 4, maxWidth: 'sm' }}>
      <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
        Time Clock
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
        Welcome, {employeeInfo?.name || user.displayName || user.email}
      </Typography>

      {/* Today's Summary */}
      <Card sx={{ mb: 3, backgroundColor: '#e3f2fd' }}>
        <CardContent>
          <Typography variant="h6" color="primary" gutterBottom>
            Today's Hours
          </Typography>
          <Typography variant="h3" color="primary">
            {todayHours.toFixed(1)}h
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {moment().format('dddd, MMMM D, YYYY')}
          </Typography>
        </CardContent>
      </Card>

      {/* Clock Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            {onLunch ? (
              <Chip 
                icon={<RestaurantIcon />} 
                label="ON LUNCH BREAK" 
                color="warning" 
                sx={{ fontSize: '1rem', py: 2 }}
              />
            ) : clockedIn ? (
              <Chip 
                icon={<AccessTimeIcon />} 
                label="CLOCKED IN" 
                color="success" 
                sx={{ fontSize: '1rem', py: 2 }}
              />
            ) : (
              <Chip 
                label="NOT CLOCKED IN" 
                color="default" 
                sx={{ fontSize: '1rem', py: 2 }}
              />
            )}
          </Typography>

          {clockedIn && currentEntry && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Clocked in at: {moment(currentEntry.clockIn).format('h:mm A')}
              </Typography>
              {!onLunch && (
                <>
                  <Typography variant="h4" color="primary" sx={{ mt: 1 }}>
                    {formatElapsedTime(elapsedTime)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    worked (excluding lunch)
                  </Typography>
                </>
              )}
              {onLunch && (
                <>
                  <Typography variant="h4" color="warning.main" sx={{ mt: 1 }}>
                    {formatElapsedTime(totalLunchTime - (currentEntry.lunchMinutes || 0) * 60)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    on lunch break
                  </Typography>
                </>
              )}
              {totalLunchTime > 0 && !onLunch && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Total lunch: {Math.floor(totalLunchTime / 60)} minutes
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Working on: {currentEntry.jobName}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Clock In/Out Controls */}
      <Paper sx={{ p: 3 }}>
        {!clockedIn ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Job
            </Typography>
            
            {jobs.length === 0 ? (
              <Typography color="error" sx={{ mb: 2 }}>
                No jobs available. Contact your manager.
              </Typography>
            ) : (
              <TextField
                select
                fullWidth
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="">-- Select a Job --</MenuItem>
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.displayName}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleClockIn}
              disabled={!selectedJob || jobs.length === 0}
              startIcon={<AccessTimeIcon />}
              sx={{ py: 2, fontSize: '1.1rem' }}
            >
              CLOCK IN
            </Button>
          </Box>
        ) : (
          <Box>
            {/* 🍔 NEW: Lunch break buttons */}
            {!onLunch ? (
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  size="large"
                  onClick={handleStartLunch}
                  startIcon={<RestaurantIcon />}
                  sx={{ py: 1.5 }}
                >
                  START LUNCH
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="warning"
                  size="large"
                  onClick={handleEndLunch}
                  startIcon={<PlayArrowIcon />}
                  sx={{ py: 1.5 }}
                >
                  END LUNCH
                </Button>
              </Box>
            )}
            
            <Button
              fullWidth
              variant="contained"
              color="error"
              size="large"
              onClick={handleClockOut}
              startIcon={<CheckCircleIcon />}
              sx={{ py: 2, fontSize: '1.1rem' }}
              disabled={onLunch}
            >
              CLOCK OUT
            </Button>
            {onLunch && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                End lunch before clocking out
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      {/* Instructions */}
      <Paper sx={{ p: 2, mt: 3, backgroundColor: '#f5f5f5' }}>
        <Typography variant="subtitle2" gutterBottom fontWeight="bold">
          Instructions:
        </Typography>
        <Typography variant="body2">
          1. Select the job you're working on<br/>
          2. Click "CLOCK IN" when you start work<br/>
          3. Click "START LUNCH" when taking a break 🍔<br/>
          4. Click "END LUNCH" when returning to work<br/>
          5. Click "CLOCK OUT" when you're done<br/>
          6. Your hours will be sent for approval
        </Typography>
      </Paper>
    </Container>
  );
}