import React from 'react';
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#1976d2', color: 'white' }}>
        <Typography variant="h4" gutterBottom>
          👷 Employee Dashboard
        </Typography>
        <Typography variant="body1">
          Welcome! Use the menu above to clock in/out and view your hours.
        </Typography>
      </Paper>

      {/* Quick Actions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              cursor: 'pointer',
              transition: 'all 0.3s',
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-4px)'
              }
            }}
            onClick={() => navigate('/time-clock')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TimeIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Time Clock
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clock in and out for your shifts
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" fullWidth>
                Go to Time Clock
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              cursor: 'pointer',
              transition: 'all 0.3s',
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-4px)'
              }
            }}
            onClick={() => navigate('/my-hours')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssessmentIcon sx={{ fontSize: 48, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    My Hours
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View your time and pay information
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" color="success" fullWidth>
                View My Hours
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Info Box */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          📋 Quick Guide
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          <li>
            <Typography variant="body2" paragraph>
              <strong>Time Clock:</strong> Use this to clock in when you start work and clock out when you finish.
            </Typography>
          </li>
          <li>
            <Typography variant="body2" paragraph>
              <strong>My Hours:</strong> Check your worked hours, pay rate, and earnings.
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>Questions?</strong> Contact your manager if you need assistance.
            </Typography>
          </li>
        </Box>
      </Paper>
    </Container>
  );
};

export default EmployeeDashboard;