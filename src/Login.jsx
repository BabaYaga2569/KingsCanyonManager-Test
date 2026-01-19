import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import Swal from 'sweetalert2';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot password state
  const [openForgotPassword, setOpenForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.email);
      
      // Call parent callback
      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // User-friendly error messages
      switch (error.code) {
        case 'auth/invalid-email':
          setError('Invalid email address format');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled. Contact administrator.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email address');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Swal.fire('Error', 'Please enter your email address', 'error');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      
      Swal.fire({
        icon: 'success',
        title: 'Password Reset Email Sent!',
        html: `
          <p>We've sent a password reset link to:</p>
          <p><strong>${resetEmail}</strong></p>
          <p>Check your email and click the link to reset your password.</p>
          <p style="color: #666; font-size: 0.9em; margin-top: 15px;">
            <em>Don't see it? Check your spam folder.</em>
          </p>
        `,
        confirmButtonText: 'OK'
      });

      setOpenForgotPassword(false);
      setResetEmail('');
      
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      }
      
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <LockIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              KCL Manager
            </Typography>
            
            <Typography variant="body1" color="text.secondary">
              Kings Canyon Landscaping LLC
            </Typography>
            
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Sign in to access your business management system
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setOpenForgotPassword(true);
                setResetEmail(email); // Pre-fill with login email if available
              }}
              sx={{
                cursor: 'pointer',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Forgot your password?
            </Link>
          </Box>

          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              © 2025 Kings Canyon Landscaping LLC
              <br />
              Authorized Access Only
            </Typography>
          </Box>
        </Paper>
      </Container>

      {/* Forgot Password Dialog */}
      <Dialog 
        open={openForgotPassword} 
        onClose={() => !resetLoading && setOpenForgotPassword(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
            Reset Password
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your email address and we'll send you a link to reset your password.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Email Address"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="your.email@example.com"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setOpenForgotPassword(false)} 
            disabled={resetLoading}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleForgotPassword} 
            variant="contained"
            disabled={resetLoading}
          >
            {resetLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;