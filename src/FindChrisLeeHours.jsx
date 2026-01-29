import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import moment from 'moment';

/**
 * FindChrisLeeHours - Quick tool to find Chris Lee's approved time
 */

function FindChrisLeeHours() {
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState([]);
  const [error, setError] = useState(null);

  const findHours = async () => {
    setLoading(true);
    setError(null);
    try {
      // Find all approved entries for Chris Lee
      const q = query(
        collection(db, 'job_time_entries'),
        where('status', '==', 'approved'),
        where('crewName', '==', 'Chris Lee')
      );
      
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort by date
      entries.sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));
      
      console.log('='.repeat(70));
      console.log('🔍 CHRIS LEE APPROVED HOURS:');
      console.log('='.repeat(70));
      entries.forEach(e => {
        console.log(`Date: ${moment(e.clockIn).format('MMM D, YYYY')}`);
        console.log(`Hours: ${e.hoursWorked}h`);
        console.log(`Clock In: ${moment(e.clockIn).format('h:mm A')}`);
        console.log(`Clock Out: ${moment(e.clockOut).format('h:mm A')}`);
        console.log(`Job: ${e.jobDescription || 'No description'}`);
        console.log(`Status: ${e.status}`);
        console.log(`Approved At: ${e.approvedAt ? moment(e.approvedAt).format('MMM D, YYYY h:mm A') : 'N/A'}`);
        console.log('-'.repeat(70));
      });
      
      const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hoursWorked || 0), 0);
      console.log(`TOTAL APPROVED HOURS: ${totalHours}h`);
      console.log('='.repeat(70));
      
      setHours(entries);
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = hours.reduce((sum, e) => sum + parseFloat(e.hoursWorked || 0), 0);

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'warning.light' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🔍 Find Chris Lee's Approved Hours
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        This will search Firebase for all approved time entries for Chris Lee
      </Alert>

      <Button
        variant="contained"
        color="primary"
        startIcon={<SearchIcon />}
        onClick={findHours}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Searching...' : 'Search Firebase'}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}

      {hours.length > 0 && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Found {hours.length} approved time entries for Chris Lee
            <br />
            <strong>Total Hours: {totalHours}h</strong>
          </Alert>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Clock In</strong></TableCell>
                <TableCell><strong>Clock Out</strong></TableCell>
                <TableCell><strong>Hours</strong></TableCell>
                <TableCell><strong>Job</strong></TableCell>
                <TableCell><strong>Approved</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hours.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{moment(entry.clockIn).format('MMM D, YYYY')}</TableCell>
                  <TableCell>{moment(entry.clockIn).format('h:mm A')}</TableCell>
                  <TableCell>{moment(entry.clockOut).format('h:mm A')}</TableCell>
                  <TableCell><strong>{entry.hoursWorked}h</strong></TableCell>
                  <TableCell>{entry.jobDescription || 'No description'}</TableCell>
                  <TableCell>{entry.approvedAt ? moment(entry.approvedAt).format('MMM D, h:mm A') : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {hours.length === 0 && !loading && !error && (
        <Alert severity="info">
          Click "Search Firebase" to find Chris Lee's approved hours
        </Alert>
      )}
    </Paper>
  );
}

export default FindChrisLeeHours;