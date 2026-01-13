import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const PasswordLock = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  // CHANGE THIS PASSWORD TO WHATEVER YOU WANT
  const CORRECT_PASSWORD = 'KCL2026!Secure';

  useEffect(() => {
    // Check if already unlocked in session
    const unlocked = sessionStorage.getItem('kcl_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem('kcl_unlocked', 'true');
      setIsUnlocked(true);
      setError('');
    } else {
      setAttempts(prev => prev + 1);
      setError(`Incorrect password. Attempt ${attempts + 1}/5`);
      setPassword('');
      
      // Lock out after 5 attempts
      if (attempts >= 4) {
        setError('Too many failed attempts. Access denied.');
        setTimeout(() => {
          window.location.href = 'https://www.google.com';
        }, 2000);
      }
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <Dialog 
      open={true} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown
      onClose={(event, reason) => {
        if (reason !== 'backdropClick') {
          return false;
        }
      }}
    >
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <LockIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          
          <Typography variant="h4" gutterBottom fontWeight="bold">
            KCL Manager
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            This application is password protected
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoFocus
              required
              sx={{ mb: 2 }}
              InputProps={{
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
              disabled={attempts >= 5}
            >
              Unlock
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            © 2025 Kings Canyon Landscaping LLC - Authorized Access Only
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordLock;