import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

export default function GoalTracker() {
  const [goal, setGoal] = useState(200000);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [currentRevenue, setCurrentRevenue] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(200000);
  const [editYear, setEditYear] = useState(new Date().getFullYear());

  // Load goal settings from Firebase
  useEffect(() => {
    const loadGoalSettings = async () => {
      try {
        const goalDoc = await getDoc(doc(db, "settings", "revenueGoal"));
        if (goalDoc.exists()) {
          const data = goalDoc.data();
          setGoal(data.amount || 200000);
          setTargetYear(data.year || new Date().getFullYear());
          setEditGoal(data.amount || 200000);
          setEditYear(data.year || new Date().getFullYear());
        }
      } catch (error) {
        console.error("Error loading goal settings:", error);
      }
    };
    loadGoalSettings();
  }, []);

  // Load revenue from payments table (actual money received)
  useEffect(() => {
    const loadRevenue = async () => {
      try {
        const paymentsSnap = await getDocs(collection(db, "payments"));
        let totalRevenue = 0;

        paymentsSnap.forEach((docSnap) => {
          const payment = docSnap.data();
          
          // Check payment year
          if (payment.paymentDate) {
            const paymentDate = payment.paymentDate.toDate ? 
              payment.paymentDate.toDate() : 
              new Date(payment.paymentDate);
            const paymentYear = paymentDate.getFullYear();
            
            // Only count payments from target year
            if (paymentYear === targetYear) {
              const amount = parseFloat(payment.amount || 0);
              totalRevenue += amount;
            }
          }
        });

        setCurrentRevenue(totalRevenue);
      } catch (error) {
        console.error("Error loading revenue:", error);
      }
    };

    loadRevenue();
  }, [targetYear]);

  const handleOpenEdit = () => {
    setEditGoal(goal);
    setEditYear(targetYear);
    setEditDialogOpen(true);
  };

  const handleSaveGoal = async () => {
    try {
      await setDoc(doc(db, "settings", "revenueGoal"), {
        amount: parseFloat(editGoal),
        year: parseInt(editYear),
        updatedAt: new Date().toISOString(),
      });

      setGoal(parseFloat(editGoal));
      setTargetYear(parseInt(editYear));
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving goal:", error);
      alert("Failed to save goal. Please try again.");
    }
  };

  // Calculate metrics
  const percentComplete = goal > 0 ? (currentRevenue / goal) * 100 : 0;
  const remaining = goal - currentRevenue;

  // Date calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31);
  const daysInYear = 365;
  
  let daysPassed, daysRemaining;
  if (targetYear < currentYear) {
    daysPassed = daysInYear;
    daysRemaining = 0;
  } else if (targetYear > currentYear) {
    daysPassed = 0;
    daysRemaining = daysInYear;
  } else {
    daysPassed = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.floor((endOfYear - now) / (1000 * 60 * 60 * 24));
  }

  // Performance metrics
  const dailyAverage = daysPassed > 0 ? currentRevenue / daysPassed : 0;
  const neededPerDay = daysRemaining > 0 ? remaining / daysRemaining : 0;
  const projectedYearEnd = dailyAverage * daysInYear;

  // Status
  const expectedRevenue = (daysPassed / daysInYear) * goal;
  const isAhead = currentRevenue >= expectedRevenue;

  // Year options
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 3 },
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          borderRadius: 2,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EmojiEventsIcon sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700}>
              {targetYear} Revenue Goal
            </Typography>
          </Box>
          <IconButton 
            sx={{ color: "white" }} 
            size="small"
            onClick={handleOpenEdit}
          >
            <EditIcon />
          </IconButton>
        </Box>

        {/* Progress */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
            <Typography variant="h4" fontWeight={700}>
              ${currentRevenue.toLocaleString()} / ${goal.toLocaleString()}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {percentComplete.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(percentComplete, 100)}
            sx={{
              height: 12,
              borderRadius: 6,
              backgroundColor: "rgba(255,255,255,0.3)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: percentComplete >= 100 ? "#4caf50" : "#FFD700",
                borderRadius: 6,
              },
            }}
          />
        </Box>

        {/* Status Chips */}
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Chip
            label={`$${remaining.toLocaleString()} to go`}
            sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", fontWeight: 600 }}
          />
          {targetYear >= currentYear && daysPassed > 0 && (
            <Chip
              label={isAhead ? "âš¡ Ahead of Pace" : "âš ï¸ Behind Pace"}
              sx={{
                backgroundColor: isAhead ? "rgba(76, 175, 80, 0.3)" : "rgba(255, 152, 0, 0.3)",
                color: "white",
                fontWeight: 600,
              }}
            />
          )}
          {targetYear > currentYear && (
            <Chip
              label="ðŸŽ¯ Future Goal"
              sx={{ backgroundColor: "rgba(33, 150, 243, 0.3)", color: "white", fontWeight: 600 }}
            />
          )}
        </Box>

        {/* Motivation Message */}
        {targetYear >= currentYear && daysRemaining > 0 && (
          <Box
            sx={{
              p: 2,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Typography variant="body1" fontWeight={600}>
              {targetYear > currentYear 
                ? `Get ready! You'll need $${(goal / daysInYear).toFixed(0)}/day to hit your ${targetYear} goal`
                : `You can do this! Focus on $${neededPerDay.toFixed(0)}/day to hit your goal`
              }
            </Typography>
          </Box>
        )}

        {/* Quick Stats */}
        <Box
          sx={{
            p: 2,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Quick Stats
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {targetYear === currentYear && (
              <>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Daily Average</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${dailyAverage.toFixed(0)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Need Per Day</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${neededPerDay.toFixed(0)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Projected Year-End</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${projectedYearEnd.toFixed(0)} {projectedYearEnd >= goal ? "ðŸŽ‰" : ""}
                  </Typography>
                </Box>
              </>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2">
                {targetYear > currentYear ? "Days Until Start" : "Days Remaining"}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {targetYear > currentYear ? Math.floor((startOfYear - now) / (1000 * 60 * 60 * 24)) : daysRemaining}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Monthly Breakdown Toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            "&:hover": { opacity: 0.8 },
          }}
          onClick={() => setShowBreakdown(!showBreakdown)}
        >
          <Typography variant="body2" fontWeight={600}>
            Show Monthly Breakdown
          </Typography>
          {showBreakdown ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>

        {/* Monthly Breakdown */}
        <Collapse in={showBreakdown}>
          <Box sx={{ mt: 2, p: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Monthly Target Breakdown
            </Typography>
            <Table size="small">
              <TableBody>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, idx) => {
                  const monthlyTarget = goal / 12;
                  const isPast = targetYear === currentYear && idx < now.getMonth();
                  const isCurrent = targetYear === currentYear && idx === now.getMonth();

                  return (
                    <TableRow key={month}>
                      <TableCell sx={{ color: "white", border: "none", py: 0.5 }}>
                        {month}
                      </TableCell>
                      <TableCell sx={{ color: "white", border: "none", py: 0.5 }} align="right">
                        ${monthlyTarget.toFixed(0)}
                      </TableCell>
                      <TableCell sx={{ color: "white", border: "none", py: 0.5 }}>
                        {isCurrent && <Chip label="Current" size="small" />}
                        {isPast && <Chip label="Past" size="small" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Collapse>
      </Paper>

      {/* Edit Goal Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Revenue Goal</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Target Year"
              select
              value={editYear}
              onChange={(e) => setEditYear(e.target.value)}
              fullWidth
              helperText="Select the year for your revenue goal"
            >
              {yearOptions.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              label="Goal Amount"
              type="number"
              value={editGoal}
              onChange={(e) => setEditGoal(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              inputProps={{ min: 0, step: 1000 }}
              helperText="Enter your target revenue for the year"
            />

            <Box sx={{ p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Monthly Target: ${(editGoal / 12).toFixed(0)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Daily Target: ${(editGoal / 365).toFixed(0)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveGoal} variant="contained">
            Save Goal
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}