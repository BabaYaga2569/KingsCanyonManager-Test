import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { checkForUpdates, forceHardRefresh, markVersionAsSeen } from './utils/refreshUtils';
import { APP_VERSION, CHANGELOG } from './version';

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    // Check for updates on component mount
    const updates = checkForUpdates();
    if (updates.hasUpdate) {
      setUpdateAvailable(true);
      setUpdateInfo(updates);
    }
  }, []);

  const handleUpdate = () => {
    // Mark version as seen first (extra safety)
    markVersionAsSeen();
    // Then clear cache and refresh
    forceHardRefresh();
  };

  const handleDismiss = () => {
    // Mark as seen but don't update yet
    markVersionAsSeen();
    setUpdateAvailable(false);
  };

  if (!updateAvailable || !updateInfo) return null;

  const latestChanges = CHANGELOG[APP_VERSION] || [];

  return (
    <Dialog
      open={updateAvailable}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SystemUpdateAltIcon color="primary" />
        <span>Update Available!</span>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          A new version of KCL Manager is available
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Current version: <strong>{updateInfo.oldVersion}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            New version: <strong>{updateInfo.newVersion}</strong>
          </Typography>
        </Box>

        {latestChanges.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              What's New:
            </Typography>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {latestChanges.map((change, index) => (
                <li key={index}>
                  <Typography variant="body2">{change}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDismiss} color="inherit">
          Later
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color="primary"
          startIcon={<SystemUpdateAltIcon />}
        >
          Update Now
        </Button>
      </DialogActions>
    </Dialog>
  );
}