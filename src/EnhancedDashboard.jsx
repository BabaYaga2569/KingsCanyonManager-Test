import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Container,
  Paper,
  Divider,
  CircularProgress,
  Stack,
  IconButton,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  TrendingUp,
  CalendarToday,
  Build,
  AttachMoney,
  Warning,
  CheckCircle,
  Refresh,
  ArrowForward,
  Assignment,
  Description,
  WorkOutline,
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GoalsSettingsModal from './GoalsSettingsModal';

const EnhancedDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  
  // Get year from URL or default to current year
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(
    parseInt(searchParams.get('year')) || currentYear
  );

  const [dashboardData, setDashboardData] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    yearRevenue: 0,
    pendingInvoices: 0,
    pendingCount: 0,
    overdueInvoices: 0,
    overdueCount: 0,
    todaySchedule: [],
    maintenanceAlerts: {
      overdue: 0,
      dueSoon: 0,
      current: 0
    },
    pipeline: {
      bidsTotal: 0,
      bidsPending: 0,
      contractsTotal: 0,
      contractsPending: 0,
      contractsSigned: 0,
      jobsScheduled: 0,
      jobsCompleted: 0,
      jobsActive: 0
    },
    monthlyGoal: 12500,
    annualGoal: 150000
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear]); // Re-fetch when year changes

  const handleYearChange = (event) => {
    const newYear = event.target.value;
    setSelectedYear(newYear);
    setSearchParams({ year: newYear }); // Update URL
  };

  // Universal date parser helper function to handle all date formats
  const parseDate = (doc, fieldNames = ['date', 'createdAt', 'paymentDate', 'invoiceDate', 'startDate', 'contractDate']) => {
    const data = doc.data ? doc.data() : doc;
    // Try multiple field names
    for (const field of fieldNames) {
      const val = data[field];
      if (!val) continue;
      // Firestore Timestamp
      if (val.toDate) return val.toDate();
      // String or Date
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Load business goals from Firebase
      const goalsDoc = await getDoc(doc(db, 'settings', 'businessGoals'));
      let monthlyGoal = 12500;
      let annualGoal = 150000;
      
      if (goalsDoc.exists()) {
        const goalsData = goalsDoc.data();
        monthlyGoal = goalsData.monthlyRevenue || 12500;
        annualGoal = goalsData.annualRevenue || 150000;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      // Date range for selected year
      const startOfYear = new Date(selectedYear, 0, 1);
      const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);

      // Fetch ALL payments and filter client-side (to handle string dates)
      // Note: This approach is necessary because dates may be stored as strings or Timestamps.
      // For better performance with large datasets, consider:
      // - Adding a time window constraint (e.g., last 2 years)
      // - Implementing pagination for historical data
      const allPaymentsSnapshot = await getDocs(collection(db, 'payments'));
      
      // Filter TODAY'S payments
      const todayRevenue = allPaymentsSnapshot.docs
        .filter(doc => {
          const paymentDate = parseDate(doc);
          return paymentDate && paymentDate >= today && paymentDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        })
        .reduce((sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0);

      // Filter THIS WEEK'S payments
      const weekRevenue = allPaymentsSnapshot.docs
        .filter(doc => {
          const paymentDate = parseDate(doc);
          return paymentDate && paymentDate >= startOfWeek;
        })
        .reduce((sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0);

      // Filter THIS MONTH'S payments
      const monthRevenue = allPaymentsSnapshot.docs
        .filter(doc => {
          const paymentDate = parseDate(doc);
          return paymentDate && paymentDate >= startOfMonth && paymentDate <= endOfMonth;
        })
        .reduce((sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0);

      // Filter SELECTED YEAR'S payments
      const yearRevenue = allPaymentsSnapshot.docs
        .filter(doc => {
          const paymentDate = parseDate(doc);
          return paymentDate && paymentDate >= startOfYear && paymentDate <= endOfYear;
        })
        .reduce((sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0);

      // Fetch ALL invoices and filter client-side (case-insensitive status check)
      // Note: For large datasets, consider adding date range constraints to improve performance
      const allInvoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const pendingInvoicesDocs = allInvoicesSnapshot.docs.filter(doc => {
        const status = doc.data().status;
        return status && (status.toLowerCase() === 'pending' || status.toLowerCase() === 'sent');
      });
      
      const pendingInvoices = pendingInvoicesDocs.reduce((sum, doc) => 
        sum + (parseFloat(doc.data().amount) || 0), 0
      );
      const pendingCount = pendingInvoicesDocs.length;

      // Calculate overdue invoices
      const overdueInvoices = pendingInvoicesDocs.filter(doc => {
        const invoiceDate = parseDate(doc);
        if (!invoiceDate) return false;
        const daysOld = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
        return daysOld > 30;
      });
      const overdueTotal = overdueInvoices.reduce((sum, doc) => 
        sum + (parseFloat(doc.data().amount) || 0), 0
      );
      const overdueCount = overdueInvoices.length;

      // Fetch today's schedule from 'schedules' collection (not 'jobs')
      // Note: Fetching all schedules for today's date. For optimization, could add
      // date range constraints if Firestore supports querying on string dates consistently
      const schedulesSnapshot = await getDocs(collection(db, 'schedules'));
      const todaySchedule = schedulesSnapshot.docs
        .filter(doc => {
          const scheduleDate = parseDate(doc);
          return scheduleDate && scheduleDate >= today && scheduleDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: parseDate(doc)
        }))
        .sort((a, b) => a.date - b.date)
        .slice(0, 5);

      // Fetch maintenance alerts (with flexible date parsing)
      const maintenanceQuery = query(
        collection(db, 'maintenanceContracts'),
        where('status', '==', 'Active')
      );
      const maintenanceSnapshot = await getDocs(maintenanceQuery);
      
      let overdueCount_m = 0;
      let dueSoonCount = 0;
      let currentCount = 0;

      maintenanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        let nextVisit = null;
        
        // Try parsing nextVisit field
        if (data.nextVisit) {
          if (data.nextVisit.toDate) {
            nextVisit = data.nextVisit.toDate();
          } else {
            const parsed = new Date(data.nextVisit);
            if (!isNaN(parsed.getTime())) {
              nextVisit = parsed;
            }
          }
        }
        
        if (nextVisit) {
          const daysUntil = Math.floor((nextVisit - today) / (1000 * 60 * 60 * 24));
          if (daysUntil < 0) {
            overdueCount_m++;
          } else if (daysUntil <= 7) {
            dueSoonCount++;
          } else {
            currentCount++;
          }
        }
      });

      // Fetch pipeline data for SELECTED YEAR with flexible date parsing
      const bidsSnapshot = await getDocs(collection(db, 'bids'));
      const bidsForYear = bidsSnapshot.docs.filter(doc => {
        const bidDate = parseDate(doc);
        return bidDate && bidDate.getFullYear() === selectedYear;
      });
      const bidsTotal = bidsForYear.length;
      const bidsPending = bidsForYear.filter(doc => {
        const data = doc.data();
        return !(data.clientSignature && data.contractorSignature);
      }).length;

      const contractsSnapshot = await getDocs(collection(db, 'contracts'));
      const contractsForYear = contractsSnapshot.docs.filter(doc => {
        const contractDate = parseDate(doc);
        return contractDate && contractDate.getFullYear() === selectedYear;
      });
      const contractsTotal = contractsForYear.length;
      
      // Check for various status values and signature fields
      const contractsPending = contractsForYear.filter(doc => {
        const status = doc.data().status;
        return status && (
          status === 'Pending' || 
          status === 'Sent - Not Signed Yet' || 
          status === 'Sent - Awaiting Client Signature'
        );
      }).length;
      
      const contractsSigned = contractsForYear.filter(doc => {
        const data = doc.data();
        return (
          data.signed === true || 
          data.status === 'Signed' ||
          (data.clientSignature && data.contractorSignature)
        );
      }).length;

      const jobsSnapshot = await getDocs(collection(db, 'jobs'));
      const jobsForYear = jobsSnapshot.docs.filter(doc => {
        const jobDate = parseDate(doc);
        return jobDate && jobDate.getFullYear() === selectedYear;
      });
      
      // Check for lowercase status values
      const jobsScheduled = jobsForYear.filter(doc => {
        const status = doc.data().status;
        return status && (
          status.toLowerCase() === 'scheduled' || 
          status.toLowerCase() === 'active'
        );
      }).length;
      
      const jobsActive = jobsForYear.filter(doc => {
        const status = doc.data().status;
        return status && (
          status.toLowerCase() === 'pending' || 
          status.toLowerCase() === 'active' ||
          status.toLowerCase() === 'in-progress'
        );
      }).length;

      // Month's completed jobs (current month only)
      const monthJobsCompleted = jobsSnapshot.docs.filter(doc => {
        const jobDate = parseDate(doc);
        const status = doc.data().status;
        return jobDate && 
               jobDate >= startOfMonth && 
               jobDate <= endOfMonth &&
               status && status.toLowerCase() === 'completed';
      }).length;

      setDashboardData({
        todayRevenue,
        weekRevenue,
        monthRevenue,
        yearRevenue,
        pendingInvoices,
        pendingCount,
        overdueInvoices: overdueTotal,
        overdueCount,
        todaySchedule,
        maintenanceAlerts: {
          overdue: overdueCount_m,
          dueSoon: dueSoonCount,
          current: currentCount
        },
        pipeline: {
          bidsTotal,
          bidsPending,
          contractsTotal,
          contractsPending,
          contractsSigned,
          jobsScheduled,
          jobsCompleted: monthJobsCompleted,
          jobsActive
        },
        monthlyGoal: monthlyGoal,
        annualGoal: annualGoal
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (date) => {
    if (!date) return 'No time';
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const monthProgress = (dashboardData.monthRevenue / dashboardData.monthlyGoal) * 100;
  const yearProgress = (dashboardData.yearRevenue / dashboardData.annualGoal) * 100;

  // Generate year options (current year + 2 years back)
  const yearOptions = [];
  for (let i = 0; i <= 2; i++) {
    yearOptions.push(currentYear - i);
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* HERO BANNER */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            mb: 3, 
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            color: 'white',
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  🏆 Business Overview
                </Typography>
                
                {/* YEAR SELECTOR */}
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={selectedYear}
                    onChange={handleYearChange}
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                    }}
                  >
                    {yearOptions.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatCurrency(dashboardData.todayRevenue)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Today</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatCurrency(dashboardData.monthRevenue)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>This Month</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatCurrency(dashboardData.yearRevenue)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {selectedYear === currentYear ? 'YTD' : selectedYear}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {selectedYear === currentYear ? monthProgress.toFixed(0) : yearProgress.toFixed(0)}%
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {selectedYear === currentYear ? 'Month Goal' : 'Year Goal'}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setGoalsModalOpen(true)}
                  sx={{ 
                    mt: 1, 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  ⚙️ Edit Goals
                </Button>
              </Box>
            </Box>
          </Box>
          <Box sx={{ mt: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(selectedYear === currentYear ? monthProgress : yearProgress, 100)} 
              sx={{ 
                height: 10, 
                borderRadius: 5,
                backgroundColor: 'rgba(255,255,255,0.3)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#fff',
                  borderRadius: 5
                }
              }}
            />
          </Box>
        </Paper>

        {/* Show year indicator if not current year */}
        {selectedYear !== currentYear && (
          <Alert severity="info" sx={{ mb: 3 }}>
            📅 Viewing data for <strong>{selectedYear}</strong>. Pipeline data, bids, contracts, and jobs are filtered for this year.
          </Alert>
        )}

        {/* REST OF THE DASHBOARD (Work Pipeline, Revenue, Schedule, etc.) */}
        {/* ... (keeping all the existing cards exactly as they are) ... */}

{/* WORK PIPELINE CARD */}
        <Card elevation={2} sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Assignment sx={{ fontSize: 40, mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                📊 Work Pipeline {selectedYear !== currentYear && `(${selectedYear})`}
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              {/* BIDS COLUMN */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(255,255,255,0.15)', 
                  borderRadius: 2,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Description sx={{ fontSize: 30, mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Bids</Typography>
                  </Box>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">📝 Total Bids</Typography>
                      <Chip 
                        label={dashboardData.pipeline.bidsTotal} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#667eea', fontWeight: 700 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">⏳ Awaiting Signature</Typography>
                      <Chip 
                        label={dashboardData.pipeline.bidsPending} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(255,193,7,0.9)', color: '#000', fontWeight: 700 }}
                      />
                    </Box>
                  </Stack>
                  <Button 
                    variant="contained" 
                    size="small" 
                    fullWidth 
                    sx={{ mt: 2, backgroundColor: 'rgba(255,255,255,0.9)', color: '#667eea', '&:hover': { backgroundColor: '#fff' } }}
                    onClick={() => navigate('/bids')}
                  >
                    View All Bids
                  </Button>
                </Box>
              </Grid>

              {/* CONTRACTS COLUMN */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(255,255,255,0.15)', 
                  borderRadius: 2,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Description sx={{ fontSize: 30, mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Contracts</Typography>
                  </Box>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">📄 Total Contracts</Typography>
                      <Chip 
                        label={dashboardData.pipeline.contractsTotal} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#764ba2', fontWeight: 700 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">⏳ Awaiting Signature</Typography>
                      <Chip 
                        label={dashboardData.pipeline.contractsPending} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(255,193,7,0.9)', color: '#000', fontWeight: 700 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">✅ Signed</Typography>
                      <Chip 
                        label={dashboardData.pipeline.contractsSigned} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(76,175,80,0.9)', color: '#fff', fontWeight: 700 }}
                      />
                    </Box>
                  </Stack>
                  <Button 
                    variant="contained" 
                    size="small" 
                    fullWidth 
                    sx={{ mt: 2, backgroundColor: 'rgba(255,255,255,0.9)', color: '#764ba2', '&:hover': { backgroundColor: '#fff' } }}
                    onClick={() => navigate('/contracts')}
                  >
                    View All Contracts
                  </Button>
                </Box>
              </Grid>

              {/* JOBS COLUMN */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(255,255,255,0.15)', 
                  borderRadius: 2,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <WorkOutline sx={{ fontSize: 30, mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Jobs</Typography>
                  </Box>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">📅 Scheduled/Active</Typography>
                      <Chip 
                        label={dashboardData.pipeline.jobsScheduled} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(33,150,243,0.9)', color: '#fff', fontWeight: 700 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">✅ Completed (Month)</Typography>
                      <Chip 
                        label={dashboardData.pipeline.jobsCompleted} 
                        size="small" 
                        sx={{ backgroundColor: 'rgba(76,175,80,0.9)', color: '#fff', fontWeight: 700 }}
                      />
                    </Box>
                  </Stack>
                  <Button 
                    variant="contained" 
                    size="small" 
                    fullWidth 
                    sx={{ mt: 2, backgroundColor: 'rgba(255,255,255,0.9)', color: '#667eea', '&:hover': { backgroundColor: '#fff' } }}
                    onClick={() => navigate('/jobs')}
                  >
                    View All Jobs
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

{/* Continue with rest of cards... I'll include the remaining cards in the next message */}

        {/* MAIN CARDS ROW */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* REVENUE CARD */}
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney sx={{ fontSize: 40, color: '#4caf50', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Revenue</Typography>
                </Box>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Today</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#4caf50' }}>
                      {formatCurrency(dashboardData.todayRevenue)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dashboardData.todaySchedule.filter(j => j.status === 'Completed').length} jobs completed
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="body2" color="text.secondary">This Week</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formatCurrency(dashboardData.weekRevenue)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="body2" color="text.secondary">This Month</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formatCurrency(dashboardData.monthRevenue)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Goal: {formatCurrency(dashboardData.monthlyGoal)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {selectedYear === currentYear ? 'Year To Date' : selectedYear}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formatCurrency(dashboardData.yearRevenue)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Goal: {formatCurrency(dashboardData.annualGoal)}
                    </Typography>
                  </Box>
                </Stack>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/payments-dashboard')}
                  endIcon={<ArrowForward />}
                >
                  View All Payments
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* SCHEDULE CARD */}
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CalendarToday sx={{ fontSize: 40, color: '#2196f3', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Today's Schedule ({dashboardData.todaySchedule.length})
                  </Typography>
                </Box>
                {dashboardData.todaySchedule.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No jobs scheduled for today
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {dashboardData.todaySchedule.slice(0, 4).map((job) => (
                      <Box 
                        key={job.id} 
                        sx={{ 
                          p: 1.5, 
                          border: '1px solid #e0e0e0', 
                          borderRadius: 1,
                          backgroundColor: job.status === 'Completed' ? '#f1f8e9' : '#fff'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {job.clientName || job.customerName || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(job.date)}
                            </Typography>
                          </Box>
                          {job.status === 'Completed' ? (
                            <Chip label="✅ Done" size="small" color="success" />
                          ) : (
                            <Chip label="Scheduled" size="small" color="info" />
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
                <Button 
                  variant="outlined" 
                  fullWidth 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/schedule-dashboard')}
                  endIcon={<ArrowForward />}
                >
                  View Full Schedule
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* MAINTENANCE CARD */}
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Build sx={{ fontSize: 40, color: '#ff9800', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Maintenance</Typography>
                </Box>
                <Stack spacing={2}>
                  {dashboardData.maintenanceAlerts.overdue > 0 && (
                    <Alert severity="error" icon={<Warning />}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        🔴 {dashboardData.maintenanceAlerts.overdue} Overdue
                      </Typography>
                      <Typography variant="caption">
                        Customers need service ASAP
                      </Typography>
                    </Alert>
                  )}
                  {dashboardData.maintenanceAlerts.dueSoon > 0 && (
                    <Alert severity="warning">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        🟡 {dashboardData.maintenanceAlerts.dueSoon} Due This Week
                      </Typography>
                      <Typography variant="caption">
                        Schedule these customers soon
                      </Typography>
                    </Alert>
                  )}
                  {dashboardData.maintenanceAlerts.current > 0 && (
                    <Alert severity="success" icon={<CheckCircle />}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        🟢 {dashboardData.maintenanceAlerts.current} Current
                      </Typography>
                      <Typography variant="caption">
                        Up to date contracts
                      </Typography>
                    </Alert>
                  )}
                  {dashboardData.maintenanceAlerts.overdue === 0 && 
                   dashboardData.maintenanceAlerts.dueSoon === 0 && 
                   dashboardData.maintenanceAlerts.current === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No active maintenance contracts
                      </Typography>
                    </Box>
                  )}
                </Stack>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/maintenance')}
                  endIcon={<ArrowForward />}
                >
                  Manage Maintenance
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* MONEY STATUS CARD */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AttachMoney sx={{ fontSize: 40, color: '#f57c00', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Money Status</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, backgroundColor: '#fff3e0', borderRadius: 2, border: '1px solid #ffb74d' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Pending Invoices
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#f57c00' }}>
                    {formatCurrency(dashboardData.pendingInvoices)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dashboardData.pendingCount} invoice{dashboardData.pendingCount !== 1 ? 's' : ''} waiting for payment
                  </Typography>
                </Box>
              </Grid>
              {dashboardData.overdueCount > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, backgroundColor: '#ffebee', borderRadius: 2, border: '1px solid #ef5350' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ⚠️ Overdue Invoices
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#d32f2f' }}>
                      {formatCurrency(dashboardData.overdueInvoices)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dashboardData.overdueCount} invoice{dashboardData.overdueCount !== 1 ? 's' : ''} overdue (30+ days)
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                color="warning"
                onClick={() => navigate('/invoices')}
              >
                View All Invoices
              </Button>
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => navigate('/payments-dashboard')}
              >
                Record Payment
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* QUICK ACTIONS */}
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              🚀 Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" color="success" onClick={() => navigate('/invoices')}>
                💵 Quick Weed Invoice
              </Button>
              <Button variant="contained" color="primary" onClick={() => navigate('/jobs')}>
                📝 Create Job
              </Button>
              <Button variant="contained" color="info" onClick={() => navigate('/payments-dashboard')}>
                💳 Record Payment
              </Button>
              <Button variant="contained" color="warning" onClick={() => navigate('/maintenance')}>
                🔧 Maintenance
              </Button>
              <Button variant="outlined" onClick={() => navigate('/customers')}>
                👥 Customers
              </Button>
              <Button variant="outlined" onClick={() => navigate('/schedule-dashboard')}>
                📅 Schedule
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* REFRESH BUTTON */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <IconButton 
            onClick={fetchDashboardData}
            sx={{ 
              backgroundColor: '#f5f5f5',
              '&:hover': { backgroundColor: '#e0e0e0' }
            }}
          >
            <Refresh />
          </IconButton>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            Refresh Dashboard
          </Typography>
        </Box>
      </Container>

      <GoalsSettingsModal 
        open={goalsModalOpen}
        onClose={() => setGoalsModalOpen(false)}
        onSave={fetchDashboardData}
      />
    </>
  );
};

export default EnhancedDashboard;