import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Divider,
  Card,
  CardContent,
  CardActions,
  IconButton,
  CircularProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import GoalTracker from "./GoalTracker";
import SideBySideComparison from "./SideBySideComparison";

function Tile({ title, count, onView, onNew }) {
  return (
    <Card 
      elevation={3}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: 'center', py: { xs: 2, sm: 3 } }}>
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}
        >
          {title}
        </Typography>
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 800, 
            mb: 2,
            fontSize: { xs: '2.5rem', sm: '3rem' },
            color: 'primary.main'
          }}
        >
          {count}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0, flexDirection: 'column', gap: 1 }}>
        <Button 
          variant="contained" 
          onClick={onView}
          fullWidth
          sx={{ py: 1 }}
        >
          View All
        </Button>
        {onNew && (
          <Button 
            variant="outlined" 
            onClick={onNew}
            fullWidth
            sx={{ py: 1 }}
          >
            New
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

export default function Dashboard() {
  const [counts, setCounts] = useState({
    customers: 0,
    bids: 0,
    contracts: 0,
    invoices: 0,
    jobs: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  const fetchCounts = async () => {
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "bids")),
        getDocs(collection(db, "contracts")),
        getDocs(collection(db, "invoices")),
        getDocs(collection(db, "jobs")),
      ]);

      setCounts({
        customers: results[0].status === 'fulfilled' ? results[0].value.size : 0,
        bids: results[1].status === 'fulfilled' ? results[1].value.size : 0,
        contracts: results[2].status === 'fulfilled' ? results[2].value.size : 0,
        invoices: results[3].status === 'fulfilled' ? results[3].value.size : 0,
        jobs: results[4].status === 'fulfilled' ? results[4].value.size : 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard counts:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleRefresh = () => {
    fetchCounts();
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3 
      }}>
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.5rem', sm: '2rem' }
          }}
        >
          Business Dashboard
        </Typography>
        
        {/* Refresh buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Data refresh button */}
          <IconButton
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              width: 44,
              height: 44,
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              '&:disabled': {
                backgroundColor: 'grey.400',
              },
            }}
            title="Refresh Data"
          >
            {refreshing ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
          
          {/* Hard refresh button (reloads entire app - for home screen app) */}
          <IconButton
            onClick={() => window.location.reload()}
            sx={{
              backgroundColor: 'secondary.main',
              color: 'white',
              width: 44,
              height: 44,
              '&:hover': {
                backgroundColor: 'secondary.dark',
              },
            }}
            title="Hard Refresh - Reloads App"
          >
            <RefreshIcon sx={{ transform: 'rotate(180deg)' }} />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Tile
            title="Customers"
            count={counts.customers}
            onView={() => navigate("/customers")}
            onNew={() => navigate("/customer/new")}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Tile
            title="Bids"
            count={counts.bids}
            onView={() => navigate("/bids")}
            onNew={() => navigate("/create-bid")}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Tile
            title="Contracts"
            count={counts.contracts}
            onView={() => navigate("/contracts")}
            onNew={null}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Tile
            title="Invoices"
            count={counts.invoices}
            onView={() => navigate("/invoices")}
            onNew={null}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Tile
            title="Jobs"
            count={counts.jobs}
            onView={() => navigate("/jobs")}
            onNew={null}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: { xs: 2, sm: 3 } }}>
        <GoalTracker />
        <SideBySideComparison />/* ← ADD THIS */}
      </Box>
      <Paper 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          mt: { xs: 2, sm: 3 }, 
          borderRadius: 2,
          boxShadow: 2
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}
        >
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            onClick={() => navigate("/create-bid")}
            fullWidth={true}
            sx={{ 
              sm: { flexGrow: 0, flexBasis: 'auto' }
            }}
          >
            New Bid
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate("/contracts")}
            fullWidth={true}
            sx={{ 
              sm: { flexGrow: 0, flexBasis: 'auto' }
            }}
          >
            Manage Contracts
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate("/invoices")}
            fullWidth={true}
            sx={{ 
              sm: { flexGrow: 0, flexBasis: 'auto' }
            }}
          >
            Manage Invoices
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate("/jobs")}
            fullWidth={true}
            sx={{ 
              sm: { flexGrow: 0, flexBasis: 'auto' }
            }}
          >
            Manage Jobs
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate("/customers")}
            fullWidth={true}
            sx={{ 
              sm: { flexGrow: 0, flexBasis: 'auto' }
            }}
          >
            Manage Customers
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}