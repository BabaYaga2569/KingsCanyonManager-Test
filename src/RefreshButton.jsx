import React, { useState } from 'react';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { forceHardRefresh } from './utils/refreshUtils';
import Swal from 'sweetalert2';

export default function RefreshButton({ isMobile = false }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    const result = await Swal.fire({
      title: 'Refresh App?',
      html: `
        <p>This will:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>Clear cached data</li>
          <li>Load the latest version</li>
          <li>Fix any loading issues</li>
        </ul>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Refresh!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1976d2',
    });

    if (result.isConfirmed) {
      setRefreshing(true);
      
      // Show loading message
      Swal.fire({
        title: 'Refreshing...',
        html: 'Please wait while we update the app',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Small delay to let the loading message show
      setTimeout(() => {
        forceHardRefresh();
      }, 500);
    }
  };

  if (isMobile) {
    return (
      <Tooltip title="Force Refresh">
        <IconButton
          color="inherit"
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{ mr: 1 }}
        >
          {refreshing ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <RefreshIcon />
          )}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      color="inherit"
      onClick={handleRefresh}
      disabled={refreshing}
      startIcon={
        refreshing ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <RefreshIcon />
        )
      }
      sx={{ mr: 1 }}
    >
      Refresh
    </Button>
  );
}