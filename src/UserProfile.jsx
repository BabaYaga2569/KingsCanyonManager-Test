import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Work as WorkIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { auth, db } from './firebase';
import { 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

const UserProfile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setPhoneNumber(data.phoneNumber || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Swal.fire('Error', 'Failed to load profile data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoneNumber = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: phoneNumber,
        updatedAt: new Date().toISOString()
      });

      Swal.fire('Success!', 'Phone number updated successfully', 'success');
      loadUserData();
    } catch (error) {
      console.error('Error updating phone:', error);
      Swal.fire('Error', 'Failed to update phone number', 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Swal.fire('Error', 'Please fill in all password fields', 'error');
      return;
    }

    if (newPassword.length < 6) {
      Swal.fire('Error', 'New password must be at least 6 characters', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire('Error', 'New passwords do not match', 'error');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Swal.fire('Error', 'No user logged in', 'error');
        return;
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Update firstLogin flag if this is their first password change
      if (userData?.firstLogin === true) {
        await updateDoc(doc(db, 'users', user.uid), {
          firstLogin: false,
          updatedAt: new Date().toISOString()
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Password Changed!',
        text: 'Your password has been updated successfully',
        confirmButtonText: 'OK'
      });

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      loadUserData();

    } catch (error) {
      console.error('Password change error:', error);
      
      let errorMessage = 'Failed to change password';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in before changing your password';
      }
      
      Swal.fire('Error', errorMessage, 'error');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'god': return '#FFD700';
      case 'admin': return '#4CAF50';
      case 'crew': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'god': return '👑 Owner (Full Access)';
      case 'admin': return '⚙️ Manager';
      case 'crew': return '👷 Crew Member';
      default: return 'User';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading profile...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Avatar
            sx={{
              width: 100,
              height: 100,
              bgcolor: getRoleBadgeColor(userData?.role),
              margin: '0 auto 20px',
              fontSize: '3rem'
            }}
          >
            <PersonIcon sx={{ fontSize: '3rem' }} />
          </Avatar>
          
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {userData?.name || 'User Profile'}
          </Typography>
          
          <Typography
            variant="subtitle1"
            sx={{
              bgcolor: getRoleBadgeColor(userData?.role),
              color: 'white',
              display: 'inline-block',
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold'
            }}
          >
            {getRoleLabel(userData?.role)}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Account Information */}
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
          Account Information
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="500">
                  {auth.currentUser?.email || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <WorkIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Job Title
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="500">
                  {userData?.jobTitle || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Employee ID
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="500" sx={{ fontSize: '0.85rem' }}>
                  {auth.currentUser?.uid.substring(0, 12)}...
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PhoneIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Phone Number
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(555) 123-4567"
                  sx={{ mt: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleUpdatePhoneNumber}
                  sx={{ mt: 1 }}
                  disabled={phoneNumber === userData?.phoneNumber}
                >
                  Update Phone
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Password Change Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Security
            </Typography>
            {!showPasswordSection && (
              <Button
                variant="contained"
                startIcon={<LockIcon />}
                onClick={() => setShowPasswordSection(true)}
              >
                Change Password
              </Button>
            )}
          </Box>

          {showPasswordSection && (
            <Card variant="outlined" sx={{ p: 3, bgcolor: '#f5f5f5' }}>
              <form onSubmit={handleChangePassword}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Password must be at least 6 characters long. You will remain logged in after changing your password.
                </Alert>

                <TextField
                  fullWidth
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
                        >
                          {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                  >
                    Update Password
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    onClick={() => {
                      setShowPasswordSection(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </form>
            </Card>
          )}
        </Box>

        {/* Account Status */}
        <Divider sx={{ my: 4 }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Account created: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default UserProfile;