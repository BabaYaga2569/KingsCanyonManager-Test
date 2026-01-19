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
import moment from "moment";
import Swal from "sweetalert2";
import ServiceClockOut from "./ServiceClockOut";

export default function TimeClock() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [clockedIn, setClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [showServiceClockOut, setShowServiceClockOut] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    let interval;
    if (clockedIn && currentEntry) {
      interval = setInterval(() => {
        const start = moment(currentEntry.clockIn);
        const now = moment();
        setElapsedTime(now.diff(start, 'seconds'));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [clockedIn, currentEntry]);

  const loadData = async () => {
    try {
      // Load jobs
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs.map((d) => {
        const data = d.data();
        // Try multiple field names in order of preference
        const jobName = data.customerName || 
                       data.customer || 
                       data.name || 
                       data.jobName || 
                       data.title ||
                       data.address ||
                       `Job ${d.id.slice(0, 6)}`;
        return { 
          id: d.id, 
          ...data,
          displayName: jobName
        };
      });
      
      console.log("Loaded jobs:", jobsData); // DEBUG
      setJobs(jobsData);

      // Check if currently clocked in
      const timeEntriesRef = collection(db, "job_time_entries");
      const q = query(
        timeEntriesRef,
        where("crewId", "==", user.uid),
        where("clockOut", "==", null),
        orderBy("clockIn", "desc")
      );
      const entriesSnap = await getDocs(q);
      
      if (!entriesSnap.empty) {
        const entry = { id: entriesSnap.docs[0].id, ...entriesSnap.docs[0].data() };
        setCurrentEntry(entry);
        setClockedIn(true);
        setSelectedJob(entry.jobId);
      }

      // Load today's total hours
      await loadTodayHours();

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
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
      let jobName;
      let jobId;
      
      if (selectedJob === "WEED_EXTRACTION") {
        jobName = "Weed Extraction Service";
        jobId = "WEED_EXTRACTION";
      } else if (selectedJob === "MAINTENANCE_SERVICE") {
        jobName = "Maintenance Service";
        jobId = "MAINTENANCE_SERVICE";
      } else {
        const job = jobs.find(j => j.id === selectedJob);
        jobName = job?.displayName || "Unknown Job";
        jobId = selectedJob;
      }
      
      const now = new Date().toISOString();

      const entryData = {
        crewId: user.uid,
        crewName: user.displayName || user.email,
        jobId: jobId,
        jobName: jobName,
        clockIn: now,
        clockOut: null,
        hoursWorked: null,
        status: "pending",
        createdAt: now,
      };

      const docRef = await addDoc(collection(db, "job_time_entries"), entryData);
      
      setCurrentEntry({ id: docRef.id, ...entryData });
      setClockedIn(true);

      Swal.fire({
        icon: "success",
        title: "Clocked In!",
        text: `Started work on ${jobName}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error clocking in:", error);
      Swal.fire("Error", "Failed to clock in", "error");
    }
  };

  const handleClockOut = () => {
    if (!currentEntry) return;
    // Open the service clock-out modal
    setShowServiceClockOut(true);
  };

  const handleServiceComplete = async () => {
    // Called when ServiceClockOut modal completes successfully
    setClockedIn(false);
    setCurrentEntry(null);
    setElapsedTime(0);
    setSelectedJob("");
    await loadTodayHours();
    setShowServiceClockOut(false);
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
            {clockedIn ? (
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
              <Typography variant="h4" color="primary" sx={{ mt: 1 }}>
                {formatElapsedTime(elapsedTime)}
              </Typography>
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
            
            {jobs.length === 0 && (
              <Typography color="text.secondary" sx={{ mb: 2, fontSize: '0.9rem' }}>
                No active jobs loaded. You can still select Weed Extraction.
              </Typography>
            )}
            <TextField
              select
              fullWidth
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">-- Select a Job --</MenuItem>
              <MenuItem value="WEED_EXTRACTION" sx={{ backgroundColor: '#e8f5e9', fontWeight: 'bold' }}>
                Weed Extraction Service
              </MenuItem>
              <MenuItem value="MAINTENANCE_SERVICE" sx={{ backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                Maintenance Service
              </MenuItem>
              {jobs.map((job) => (
                <MenuItem key={job.id} value={job.id}>
                  {job.displayName}
                </MenuItem>
              ))}
            </TextField>

            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleClockIn}
              disabled={!selectedJob}
              startIcon={<AccessTimeIcon />}
              sx={{ py: 2, fontSize: '1.1rem' }}
            >
              CLOCK IN
            </Button>
          </Box>
        ) : (
          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            onClick={handleClockOut}
            startIcon={<CheckCircleIcon />}
            sx={{ py: 2, fontSize: '1.1rem' }}
          >
            CLOCK OUT
          </Button>
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
          3. Click "CLOCK OUT" when you're done<br/>
          4. Complete service details and collect payment
        </Typography>
      </Paper>

      {/* Service Clock-Out Modal */}
      <ServiceClockOut
        open={showServiceClockOut}
        onClose={() => setShowServiceClockOut(false)}
        timeEntry={currentEntry}
        jobType={currentEntry?.jobId}
        onComplete={handleServiceComplete}
      />
    </Container>
  );
}