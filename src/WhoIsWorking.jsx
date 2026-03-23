import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  CircularProgress,
  Avatar,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import moment from "moment";
import Swal from "sweetalert2";

export default function WhoIsWorking() {
  const [loading, setLoading] = useState(true);
  const [activeEntries, setActiveEntries] = useState([]);

  useEffect(() => {
    loadActiveEntries();
    // Refresh every 30 seconds
    const interval = setInterval(loadActiveEntries, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveEntries = async () => {
    try {
      const timeEntriesRef = collection(db, "job_time_entries");
      const q = query(timeEntriesRef, where("clockOut", "==", null));
      
      const entriesSnap = await getDocs(q);
      const entriesData = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      setActiveEntries(entriesData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading active entries:", error);
      setLoading(false);
    }
  };

  const handleClockOutForCrew = async (entry) => {
    const result = await Swal.fire({
      title: "Clock Out Crew Member?",
      html: `
        <p>Clock out <strong>${entry.crewName}</strong>?</p>
        <p>Working on: ${entry.clientName || entry.customerName || entry.jobName}</p>
        <p>Started: ${moment(entry.clockIn).format('h:mm A')}</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Clock Out",
    });

    if (result.isConfirmed) {
      try {
        const now = new Date().toISOString();
        const clockInTime = moment(entry.clockIn);
        const clockOutTime = moment(now);
        const hours = clockOutTime.diff(clockInTime, 'hours', true);

        await updateDoc(doc(db, "job_time_entries", entry.id), {
          clockOut: now,
          hoursWorked: parseFloat(hours.toFixed(2)),
          updatedAt: now,
        });

        setActiveEntries(activeEntries.filter(e => e.id !== entry.id));

        Swal.fire({
          icon: "success",
          title: "Clocked Out!",
          text: `${entry.crewName} worked ${hours.toFixed(2)} hours`,
          timer: 2000,
        });
      } catch (error) {
        console.error("Error clocking out crew:", error);
        Swal.fire("Error", "Failed to clock out crew member", "error");
      }
    }
  };

  const getElapsedTime = (clockIn) => {
    const start = moment(clockIn);
    const now = moment();
    const hours = now.diff(start, 'hours');
    const minutes = now.diff(start, 'minutes') % 60;
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccessTimeIcon color="primary" />
        <Typography variant="h6">Who's Working Now</Typography>
        <Chip 
          label={activeEntries.length} 
          size="small" 
          color={activeEntries.length > 0 ? "success" : "default"}
        />
      </Box>

      {activeEntries.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No one is currently clocked in
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeEntries.map((entry) => (
            <Box 
              key={entry.id}
              sx={{ 
                p: 2, 
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: '#f5f5f5'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {entry.crewName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {entry.clientName || entry.customerName || 'Unknown Client'}
                  </Typography>
                </Box>
                <Chip 
                  icon={<AccessTimeIcon />}
                  label={getElapsedTime(entry.clockIn)} 
                  size="small" 
                  color="success"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Started: {moment(entry.clockIn).format('h:mm A')}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => handleClockOutForCrew(entry)}
                >
                  Clock Out
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}