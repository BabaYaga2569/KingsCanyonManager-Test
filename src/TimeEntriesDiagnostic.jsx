import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip, TextField, Tabs, Tab } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import moment from 'moment';

/**
 * TimeEntriesDiagnostic - See EVERYTHING in job_time_entries table
 */

function TimeEntriesDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [allEntries, setAllEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);

  const loadAllEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get ALL time entries (no filter)
      const snap = await getDocs(collection(db, 'job_time_entries'));
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort by date
      entries.sort((a, b) => new Date(b.clockIn || b.createdAt) - new Date(a.clockIn || a.createdAt));
      
      console.log('='.repeat(70));
      console.log('🔍 ALL TIME ENTRIES IN DATABASE:');
      console.log('='.repeat(70));
      console.log(`Total entries: ${entries.length}`);
      
      // Count by status
      const statusCounts = {};
      const nameCounts = {};
      entries.forEach(e => {
        const status = e.status || 'no status';
        const name = e.crewName || 'no name';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        nameCounts[name] = (nameCounts[name] || 0) + 1;
      });
      
      console.log('\n📊 STATUS BREAKDOWN:');
      Object.keys(statusCounts).forEach(status => {
        console.log(`  ${status}: ${statusCounts[status]} entries`);
      });
      
      console.log('\n👥 EMPLOYEE BREAKDOWN:');
      Object.keys(nameCounts).forEach(name => {
        console.log(`  ${name}: ${nameCounts[name]} entries`);
      });
      
      console.log('\n📋 SAMPLE ENTRIES:');
      entries.slice(0, 5).forEach(e => {
        console.log(`  ${e.crewName || 'NO NAME'} - ${e.status || 'NO STATUS'} - ${e.hoursWorked || '?'}h - ${e.clockIn ? moment(e.clockIn).format('MMM D') : 'NO DATE'}`);
      });
      console.log('='.repeat(70));
      
      setAllEntries(entries);
      setFilteredEntries(entries);
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter by name
  const handleSearch = (name) => {
    setSearchName(name);
    if (!name.trim()) {
      setFilteredEntries(allEntries);
    } else {
      const filtered = allEntries.filter(e => 
        (e.crewName || '').toLowerCase().includes(name.toLowerCase())
      );
      setFilteredEntries(filtered);
    }
  };

  // Filter by status
  const getEntriesByStatus = (status) => {
    return allEntries.filter(e => (e.status || '').toLowerCase() === status.toLowerCase());
  };

  const pendingEntries = getEntriesByStatus('pending');
  const approvedEntries = getEntriesByStatus('approved');
  const paidEntries = getEntriesByStatus('paid');
  const rejectedEntries = getEntriesByStatus('rejected');

  // Get unique names
  const uniqueNames = [...new Set(allEntries.map(e => e.crewName).filter(Boolean))];

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.light' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🔍 Time Entries Diagnostic Tool
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        This will show you EVERYTHING in the job_time_entries table
        <br />
        Use this to see what names and statuses actually exist
      </Alert>

      <Button
        variant="contained"
        color="primary"
        startIcon={<SearchIcon />}
        onClick={loadAllEntries}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Loading...' : 'Load All Time Entries'}
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {allEntries.length > 0 && (
        <>
          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Chip label={`Total: ${allEntries.length}`} color="primary" />
            <Chip label={`Pending: ${pendingEntries.length}`} color="warning" />
            <Chip label={`Approved: ${approvedEntries.length}`} color="success" />
            <Chip label={`Paid: ${paidEntries.length}`} color="info" />
            {rejectedEntries.length > 0 && <Chip label={`Rejected: ${rejectedEntries.length}`} color="error" />}
          </Box>

          {/* Unique Names */}
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>Employees found in database:</strong>
            <br />
            {uniqueNames.length > 0 ? uniqueNames.join(', ') : 'None'}
          </Alert>

          {/* Search */}
          <TextField
            label="Filter by Employee Name"
            value={searchName}
            onChange={(e) => handleSearch(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Type name to filter..."
          />

          {/* Tabs */}
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label={`All (${allEntries.length})`} />
            <Tab label={`Pending (${pendingEntries.length})`} />
            <Tab label={`Approved (${approvedEntries.length})`} />
            <Tab label={`Paid (${paidEntries.length})`} />
          </Tabs>

          {/* Table */}
          <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Clock In</strong></TableCell>
                  <TableCell><strong>Clock Out</strong></TableCell>
                  <TableCell><strong>Hours</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Job</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(activeTab === 0 ? filteredEntries :
                  activeTab === 1 ? pendingEntries :
                  activeTab === 2 ? approvedEntries :
                  paidEntries
                ).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell><strong>{entry.crewName || 'NO NAME'}</strong></TableCell>
                    <TableCell>{entry.clockIn ? moment(entry.clockIn).format('MMM D, YYYY') : 'NO DATE'}</TableCell>
                    <TableCell>{entry.clockIn ? moment(entry.clockIn).format('h:mm A') : '—'}</TableCell>
                    <TableCell>{entry.clockOut ? moment(entry.clockOut).format('h:mm A') : '—'}</TableCell>
                    <TableCell><strong>{entry.hoursWorked || '?'}h</strong></TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.status || 'no status'} 
                        size="small"
                        color={
                          entry.status === 'approved' ? 'success' :
                          entry.status === 'pending' ? 'warning' :
                          entry.status === 'paid' ? 'info' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{entry.jobDescription || 'No description'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {filteredEntries.length === 0 && searchName && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No entries found for "{searchName}". Try searching for:
              <br />
              {uniqueNames.map(name => `"${name}"`).join(', ')}
            </Alert>
          )}
        </>
      )}

      {allEntries.length === 0 && !loading && !error && (
        <Alert severity="info">
          Click "Load All Time Entries" to see what's in the database
        </Alert>
      )}
    </Paper>
  );
}

export default TimeEntriesDiagnostic;