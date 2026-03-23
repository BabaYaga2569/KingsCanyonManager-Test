import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, getDoc, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
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
  Alert,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import moment from "moment";
import Swal from "sweetalert2";
import {
  notifyCrewClockIn,
  notifyCrewClockOut,
  notifyLunchStart,
  notifyLunchEnd,
} from "./pushoverNotificationService";

// Safe wrapper for optional exports that may not exist in all deployments
async function safeNotifyFailedClockIn(name, job, feet, miles, address) {
  try {
    const mod = await import("./pushoverNotificationService");
    if (mod.notifyFailedClockIn) await mod.notifyFailedClockIn(name, job, feet, miles, address);
  } catch (e) { console.warn("notifyFailedClockIn unavailable:", e.message); }
}
async function safeNotifyFailedClockOut(name, job, feet, miles, address, hours) {
  try {
    const mod = await import("./pushoverNotificationService");
    if (mod.notifyFailedClockOut) await mod.notifyFailedClockOut(name, job, feet, miles, address, hours);
  } catch (e) { console.warn("notifyFailedClockOut unavailable:", e.message); }
}

export default function TimeClock() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [clockedIn, setClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [onLunch, setOnLunch] = useState(false);
  const [lunchStartTime, setLunchStartTime] = useState(null);

  // Timer
  useEffect(() => {
    let interval;
    if (clockedIn && currentEntry) {
      interval = setInterval(() => {
        const start = moment(currentEntry.clockIn);
        const totalSeconds = moment().diff(start, "seconds");
        const lunchSeconds = currentEntry.lunchMinutes ? currentEntry.lunchMinutes * 60 : 0;
        setElapsedTime(totalSeconds - lunchSeconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [clockedIn, currentEntry]);

  useEffect(() => {
    if (user) {
      loadEmployeeInfo();
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadEmployeeInfo = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userDoc = usersSnap.docs.find(d => d.data().uid === user.uid || d.id === user.uid);
      if (userDoc) setEmployeeInfo({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
      console.error("Error loading employee info:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(j => j.status !== "Completed" && j.status !== "Cancelled" && j.status !== "cancelled")
        .map(j => ({
          ...j,
          displayName: `${j.clientName || j.customerName || "Unknown Client"} — ${j.description || j.jobType || "Job"}`,
        }));
      setJobs(jobsData);

      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const openQuery = query(
        collection(db, "job_time_entries"),
        where("crewId", "==", user.uid),
        where("clockOut", "==", null),
        orderBy("clockIn", "desc")
      );
      const openSnap = await getDocs(openQuery);
      const openEntries = openSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const zombieEntries = openEntries.filter(e => new Date(e.clockIn).getTime() < twelveHoursAgo);
      const currentOpenEntry = openEntries.find(e => new Date(e.clockIn).getTime() >= twelveHoursAgo);

      for (const zombie of zombieEntries) {
        await updateDoc(doc(db, "job_time_entries", zombie.id), {
          clockOut: zombie.clockIn,
          hoursWorked: 0,
          status: "auto_closed",
          updatedAt: new Date().toISOString(),
          autoClosedReason: "Entry older than 12 hours without clock out",
        });
      }

      if (currentOpenEntry) {
        setCurrentEntry(currentOpenEntry);
        setClockedIn(true);
        setSelectedJob(currentOpenEntry.jobId);
        setOnLunch(!!currentOpenEntry.lunchStartTime && !currentOpenEntry.lunchEndTime);
        setLunchStartTime(currentOpenEntry.lunchStartTime || null);
        const totalSeconds = moment().diff(moment(currentOpenEntry.clockIn), "seconds");
        const lunchSeconds = currentOpenEntry.lunchMinutes ? currentOpenEntry.lunchMinutes * 60 : 0;
        setElapsedTime(totalSeconds - lunchSeconds);
      } else {
        setClockedIn(false);
        setCurrentEntry(null);
      }

      await loadTodayHours();
      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const loadTodayHours = async () => {
    try {
      const todayStart = moment().startOf("day").toISOString();
      const todayEnd = moment().endOf("day").toISOString();
      const q = query(
        collection(db, "job_time_entries"),
        where("crewId", "==", user.uid),
        where("clockIn", ">=", todayStart),
        where("clockIn", "<=", todayEnd)
      );
      const snap = await getDocs(q);
      let total = 0;
      snap.docs.forEach(d => { if (d.data().hoursWorked) total += parseFloat(d.data().hoursWorked); });
      setTodayHours(total);
    } catch (error) {
      console.error("Error loading today's hours:", error);
    }
  };

  // GPS Geofence Check
  const runGpsCheck = async (job) => {
    // Skip GPS if employee has requireGps turned off
    if (employeeInfo?.requireGps === false) {
      console.log("GPS check skipped — requireGps disabled");
      return { passed: true, gpsData: {} };
    }

    // Skip GPS for quick weed service only
    // Maintenance jobs require GPS so Darren can verify crew is on site
    const jobType = (job?.jobType || "").toLowerCase();
    const jobNameStr = (job?.displayName || job?.clientName || "").toLowerCase();
    if (jobType.includes("weed") || jobNameStr.includes("weed-service") || jobNameStr.includes("weed service")) {
      console.log("GPS check skipped for weed service job");
      return { passed: true, gpsData: {} };
    }

    // Step 1: Resolve address via customer lookup
    let jobAddress = null;
    let customerDocData = null;
    const customerId = job?.customerId;

    if (customerId) {
      try {
        const customerSnap = await getDoc(doc(db, "customers", customerId));
        if (customerSnap.exists()) {
          customerDocData = customerSnap.data();
          const c = customerDocData;
          const parts = [c.address, c.city, c.state, c.zip].filter(Boolean);
          if (parts.length > 0) jobAddress = parts.join(", ");
        }
      } catch (e) {
        console.error("Error fetching customer for GPS:", e);
      }
    }

    if (!jobAddress) {
      await Swal.fire({ icon: "warning", title: "No Address Found", text: "Could not verify job site location. Clocking in anyway.", timer: 3000, showConfirmButton: false });
      return { passed: true, gpsData: {} };
    }

    // Step 2: Get GPS — HARD BLOCK if denied
    let position;
    try {
      position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        })
      );
    } catch (e) {
      console.error("Geolocation error:", e);
      const employeeName = employeeInfo?.name || user.displayName || user.email;
      const jobDisplayName = job?.displayName || job?.clientName || "Unknown Job";

      if (e.code === 1) {
        // PERMISSION_DENIED — hard block + notify admin
        try {
          await safeNotifyFailedClockIn(
            employeeName,
            `${jobDisplayName} — DENIED GPS PERMISSION`,
            0,
            0,
            jobAddress
          );
        } catch (notifyErr) {
          console.error("Failed to send GPS denial notification:", notifyErr);
        }

        await Swal.fire({
          icon: "error",
          title: "GPS Permission Required",
          html: `Location access is <strong>required</strong> to clock in.<br/><br/>
                 Please enable location permissions in your browser settings and try again.<br/><br/>
                 <small style="color:#888">Your manager has been notified.</small>`,
          confirmButtonText: "OK",
          confirmButtonColor: "#d32f2f",
        });
        return { passed: false, gpsData: {} };
      }

      // Timeout or other error — allow clock in
      await Swal.fire({ icon: "warning", title: "GPS Unavailable", text: "Could not get your location. Clocking in anyway.", timer: 3000, showConfirmButton: false });
      return { passed: true, gpsData: {} };
    }

    const { latitude, longitude, accuracy } = position.coords;

    // Step 3: Use stored coords from customer doc
    const jobLat = customerDocData?.geoLat || null;
    const jobLng = customerDocData?.geoLng || null;

    if (!jobLat || !jobLng) {
      await Swal.fire({
        icon: "warning",
        title: "Address Not Verified",
        html: `This job site has no verified GPS coordinates.<br/>Ask your manager to update the customer address.<br/><br/><small style="color:#888">Clocking in anyway.</small>`,
        timer: 4000,
        showConfirmButton: false,
      });
      return { passed: true, gpsData: { gpsLat: latitude, gpsLng: longitude, gpsAccuracy: Math.round(accuracy), jobAddress } };
    }

    // Step 4: Haversine distance in feet
    const R = 20902231;
    const dLat = ((jobLat - latitude) * Math.PI) / 180;
    const dLng = ((jobLng - longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((latitude * Math.PI) / 180) * Math.cos((jobLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distanceFeet = Math.round(R * 2 * Math.asin(Math.sqrt(a)));
    const distanceMiles = (distanceFeet / 5280).toFixed(2);

    const gpsData = {
      gpsLat: latitude,
      gpsLng: longitude,
      gpsAccuracy: Math.round(accuracy),
      gpsDistanceFeet: distanceFeet,
      gpsDistanceMiles: parseFloat(distanceMiles),
      jobAddress,
      gpsJobLat: jobLat,
      gpsJobLng: jobLng,
    };

    // Step 5: Enforce 500 ft geofence
    if (distanceFeet > 500) {
      await Swal.fire({
        icon: "error",
        title: "Too Far from Job Site",
        html: `You are <strong>${distanceFeet.toLocaleString()} ft (${distanceMiles} mi)</strong> from the job site.<br/><br/>
               You must be within <strong>500 ft</strong> to clock in.<br/>
               <small style="color:#888">${jobAddress}</small>`,
        confirmButtonText: "OK",
      });
      try {
        await safeNotifyFailedClockIn(
          employeeInfo?.name || user.displayName || user.email,
          job?.displayName || job?.clientName || "Unknown Job",
          distanceFeet,
          parseFloat(distanceMiles),
          jobAddress
        );
      } catch (e) {
        console.error("Failed to send blocked clock-in notification:", e);
      }
      return { passed: false, gpsData };
    }

    return { passed: true, gpsData };
  };

  // Clock In
  const handleClockIn = async () => {
    if (!selectedJob) {
      Swal.fire("Error", "Please select a job first", "warning");
      return;
    }
    try {
      const job = jobs.find(j => j.id === selectedJob);
      const { passed, gpsData } = await runGpsCheck(job);
      if (!passed) return;

      const now = new Date().toISOString();
      const employeeName = employeeInfo?.name || user.displayName || user.email;

      const entryData = {
        crewId: user.uid,
        crewName: employeeName,
        crewEmail: user.email,
        jobId: selectedJob,
        jobName: job?.displayName || "Unknown Job",
        clientName: job?.clientName || job?.customerName || "Unknown Client",
        jobDescription: job?.displayName || "No description",
        clockIn: now,
        clockOut: null,
        hoursWorked: null,
        lunchStartTime: null,
        lunchEndTime: null,
        lunchMinutes: 0,
        status: "pending",
        createdAt: now,
        ...gpsData,
      };

      const docRef = await addDoc(collection(db, "job_time_entries"), entryData);
      setCurrentEntry({ id: docRef.id, ...entryData });
      setClockedIn(true);

      try {
        const clockInLocation = gpsData?.jobAddress
          ? `${job?.clientName || job?.customerName || "Unknown"} — ${gpsData.jobAddress}`
          : job?.clientName || job?.customerName || job?.displayName || "Unknown Job";
        await notifyCrewClockIn(employeeName, clockInLocation);
      } catch (e) { console.error("Clock in notification error:", e); }

      Swal.fire({ icon: "success", title: "Clocked In!", text: `Started work on ${job?.displayName || "job"}`, timer: 2000, showConfirmButton: false });
    } catch (error) {
      console.error("Error clocking in:", error);
      Swal.fire("Error", "Failed to clock in", "error");
    }
  };

  // Lunch Start
  const handleStartLunch = async () => {
    if (!currentEntry) return;
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "job_time_entries", currentEntry.id), { lunchStartTime: now, updatedAt: now });
      setOnLunch(true);
      setLunchStartTime(now);
      setCurrentEntry({ ...currentEntry, lunchStartTime: now });
      try { await notifyLunchStart(currentEntry.crewName || user.email, currentEntry.jobName || null); } catch (e) {}
      Swal.fire({ icon: "info", title: "Lunch Break Started", text: "Enjoy your meal!", timer: 2000, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Error", "Failed to start lunch break", "error");
    }
  };

  // Lunch End
  const handleEndLunch = async () => {
    if (!currentEntry || !lunchStartTime) return;
    try {
      const now = new Date().toISOString();
      const lunchMinutes = moment(now).diff(moment(lunchStartTime), "minutes");
      const totalLunchMinutes = (currentEntry.lunchMinutes || 0) + lunchMinutes;
      await updateDoc(doc(db, "job_time_entries", currentEntry.id), { lunchEndTime: now, lunchMinutes: totalLunchMinutes, updatedAt: now });
      setOnLunch(false);
      setLunchStartTime(null);
      setCurrentEntry({ ...currentEntry, lunchEndTime: now, lunchMinutes: totalLunchMinutes });
      try { await notifyLunchEnd(currentEntry.crewName || user.email, lunchMinutes, currentEntry.jobName || null); } catch (e) {}
      Swal.fire({ icon: "success", title: "Back to Work!", text: `Lunch: ${lunchMinutes} minutes`, timer: 2000, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Error", "Failed to end lunch break", "error");
    }
  };

  // Clock Out
  const handleClockOut = async () => {
    if (!currentEntry) return;
    try {
      const now = new Date().toISOString();
      const totalHours = moment(now).diff(moment(currentEntry.clockIn), "hours", true);
      const lunchHours = (currentEntry.lunchMinutes || 0) / 60;
      const workedHours = totalHours - lunchHours;

      let gpsOutData = {};
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
        );
        const { latitude, longitude, accuracy } = position.coords;
        const jobLat = currentEntry.gpsJobLat || null;
        const jobLng = currentEntry.gpsJobLng || null;
        if (jobLat && jobLng) {
          const R = 20902231;
          const dLat = ((jobLat - latitude) * Math.PI) / 180;
          const dLng = ((jobLng - longitude) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((latitude * Math.PI) / 180) * Math.cos((jobLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          const distanceFeet = Math.round(R * 2 * Math.asin(Math.sqrt(a)));
          gpsOutData = { gpsOutLat: latitude, gpsOutLng: longitude, gpsOutAccuracy: Math.round(accuracy), gpsOutDistanceFeet: distanceFeet, gpsOutDistanceMiles: parseFloat((distanceFeet / 5280).toFixed(2)) };
        } else {
          gpsOutData = { gpsOutLat: latitude, gpsOutLng: longitude, gpsOutAccuracy: Math.round(accuracy) };
        }
        if (gpsOutData.gpsOutDistanceFeet != null && gpsOutData.gpsOutDistanceFeet > 500) {
          await Swal.fire({
            icon: "warning",
            title: "Not at Job Site",
            html: `You are <strong>${gpsOutData.gpsOutDistanceFeet.toLocaleString()} ft (${gpsOutData.gpsOutDistanceMiles} mi)</strong> from the job site.<br/><br/>Your manager has been notified.<br/><small style="color:#888">${currentEntry.jobAddress || ""}</small>`,
            confirmButtonText: "Clock Out Anyway",
            confirmButtonColor: "#d32f2f",
          });
          try {
            await safeNotifyFailedClockOut(currentEntry.crewName || user.email, currentEntry.jobName || "Unknown Job", gpsOutData.gpsOutDistanceFeet, gpsOutData.gpsOutDistanceMiles, currentEntry.jobAddress || null, workedHours.toFixed(2));
          } catch (e) { console.error("Failed to send off-site clock-out notification:", e); }
        }
      } catch (e) {
        console.warn("Clock-out GPS unavailable:", e.message);
      }

      await updateDoc(doc(db, "job_time_entries", currentEntry.id), { clockOut: now, hoursWorked: parseFloat(workedHours.toFixed(2)), updatedAt: now, ...gpsOutData });

      setClockedIn(false);
      setCurrentEntry(null);
      setElapsedTime(0);
      setSelectedJob("");
      setOnLunch(false);
      setLunchStartTime(null);
      await loadTodayHours();

      try {
        await notifyCrewClockOut(currentEntry.crewName || user.email, workedHours.toFixed(2), { ...gpsOutData, jobAddress: currentEntry.jobAddress || null });
      } catch (e) { console.error("Clock out notification error:", e); }

      Swal.fire({
        icon: "success",
        title: "Clocked Out!",
        html: `<p>Total time: <strong>${totalHours.toFixed(2)} hours</strong></p>${currentEntry.lunchMinutes ? `<p>Lunch: ${currentEntry.lunchMinutes} min deducted</p>` : ""}<p>Hours worked: <strong>${workedHours.toFixed(2)}</strong></p>`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error clocking out:", error);
      Swal.fire("Error", "Failed to clock out", "error");
    }
  };

  const formatElapsedTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
    <Container maxWidth="sm" sx={{ mt: 4, pb: 6 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        Time Clock
      </Typography>

      {todayHours > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Today's total: <strong>{todayHours.toFixed(2)} hours</strong>
        </Alert>
      )}

      {clockedIn && currentEntry && (
        <Card sx={{ mb: 3, bgcolor: "#e8f5e9", border: "2px solid #4caf50" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Chip label="CLOCKED IN" color="success" size="small" />
              {onLunch && <Chip label="ON LUNCH" color="warning" size="small" />}
            </Box>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
              {formatElapsedTime(elapsedTime)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Clocked in at: {moment(currentEntry.clockIn).format("h:mm A")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Working on: {currentEntry.jobName}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Paper sx={{ p: 3 }}>
        {!clockedIn ? (
          <Box>
            <Typography variant="h6" gutterBottom>Select Job</Typography>
            {jobs.length === 0 ? (
              <Typography color="error" sx={{ mb: 2 }}>No jobs available. Contact your manager.</Typography>
            ) : (
              <TextField select fullWidth value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} sx={{ mb: 2 }}>
                <MenuItem value="">-- Select a Job --</MenuItem>
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>{job.displayName}</MenuItem>
                ))}
              </TextField>
            )}
            <Button fullWidth variant="contained" color="success" size="large" onClick={handleClockIn} disabled={!selectedJob || jobs.length === 0} startIcon={<AccessTimeIcon />} sx={{ py: 2, fontSize: "1.1rem" }}>
              CLOCK IN
            </Button>
            <Alert severity="info" sx={{ mt: 2 }} icon={<MyLocationIcon />}>
              GPS location is <strong>required</strong> to clock in. You must allow location access when prompted.
            </Alert>
          </Box>
        ) : (
          <Box>
            {!onLunch ? (
              <Button fullWidth variant="outlined" color="warning" size="large" onClick={handleStartLunch} sx={{ mb: 2, py: 1.5 }}>
                Start Lunch Break
              </Button>
            ) : (
              <Button fullWidth variant="contained" color="warning" size="large" onClick={handleEndLunch} sx={{ mb: 2, py: 1.5 }}>
                End Lunch Break
              </Button>
            )}
            <Button fullWidth variant="contained" color="error" size="large" onClick={handleClockOut} disabled={onLunch} startIcon={<CheckCircleIcon />} sx={{ py: 2, fontSize: "1.1rem" }}>
              CLOCK OUT
            </Button>
            {onLunch && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
                End lunch before clocking out
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mt: 3, backgroundColor: "#f5f5f5" }}>
        <Typography variant="subtitle2" gutterBottom fontWeight="bold">Instructions:</Typography>
        <Typography variant="body2">
          1. Select the job you're working on<br />
          2. Allow location access when prompted — <strong>required</strong> to clock in<br />
          3. Click "CLOCK IN" when you start work<br />
          4. Use lunch buttons if taking a break<br />
          5. Click "CLOCK OUT" when done
        </Typography>
      </Paper>
    </Container>
  );
}