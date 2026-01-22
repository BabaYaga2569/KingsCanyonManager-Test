import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { APP_VERSION, APP_NAME, LAST_UPDATED } from './version';
import { getTimeSinceLastRefresh, forceHardRefresh } from './utils/refreshUtils';
import Swal from 'sweetalert2';

export default function VersionDisplay() {
  const handleVersionClick = () => {
    const lastRefresh = getTimeSinceLastRefresh();
    
    Swal.fire({
      title: `${APP_NAME}`,
      html: `
        <div style="text-align: left;">
          <p><strong>Version:</strong> ${APP_VERSION}</p>
          <p><strong>Last Updated:</strong> ${LAST_UPDATED}</p>
          ${lastRefresh ? `<p><strong>Last Refresh:</strong> ${lastRefresh}</p>` : ''}
          <hr />
          <p style="font-size: 0.9em; color: #666;">
            Click "Force Refresh" below to clear cache and load the latest version.
          </p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Force Refresh',
      cancelButtonText: 'Close',
      confirmButtonColor: '#1976d2',
    }).then((result) => {
      if (result.isConfirmed) {
        forceHardRefresh();
      }
    });
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        transition: 'all 0.2s',
        zIndex: 1000,
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          transform: 'scale(1.05)',
        },
      }}
      onClick={handleVersionClick}
    >
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        v{APP_VERSION}
      </Typography>
      <Tooltip title="Click for app info">
        <InfoIcon sx={{ fontSize: 14 }} />
      </Tooltip>
    </Box>
  );
}