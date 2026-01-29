import React, { useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { Box, Button, Paper, Typography, Alert, List, ListItem, ListItemText, LinearProgress } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';

/**
 * EmployeeNameMigration - One-time tool to rename email entries to actual names
 * Uses the "users" collection to lookup employee names by email
 */

function EmployeeNameMigration() {
  const [phase, setPhase] = useState('ready');
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const scanEntries = async () => {
    setPhase('scanning');
    setProgress('Loading employees and scanning time entries...');
    setError(null);
    setFound(null);

    try {
      // Load employees from users collection
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('✅ Loaded', users.length, 'employees from users collection');
      
      // Create email → name mapping
      const emailToName = {};
      users.forEach(user => {
        if (user.email && user.name) {
          emailToName[user.email.toLowerCase()] = user.name;
        }
      });
      
      console.log('📧 Email mappings:', emailToName);

      // Load all time entries
      const timeSnap = await getDocs(collection(db, 'job_time_entries'));
      const entries = timeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('⏰ Total time entries:', entries.length);
      
      // Find entries that need renaming (where crewName is an email)
      const toRename = [];
      entries.forEach(entry => {
        const crewName = entry.crewName;
        if (crewName && crewName.includes('@')) {
          // It's an email - lookup the real name
          const realName = emailToName[crewName.toLowerCase()];
          if (realName) {
            toRename.push({
              id: entry.id,
              oldName: crewName,
              newName: realName,
              status: entry.status,
              hours: entry.hoursWorked,
              date: entry.clockIn,
            });
          } else {
            console.log('⚠️ No employee found for:', crewName);
          }
        }
      });
      
      console.log(`Found ${toRename.length} entries to rename`);
      
      // Group by email
      const grouped = {};
      toRename.forEach(item => {
        if (!grouped[item.oldName]) {
          grouped[item.oldName] = {
            oldName: item.oldName,
            newName: item.newName,
            count: 0,
            entries: [],
          };
        }
        grouped[item.oldName].count++;
        grouped[item.oldName].entries.push(item);
      });
      
      setFound(Object.values(grouped));
      setPhase('scanned');
      setProgress(`Scan complete! Found ${toRename.length} entries to rename.`);
      
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setPhase('ready');
    }
  };

  const renameEntries = async () => {
    setPhase('renaming');
    setProgress('Renaming entries...');
    setResults(null);

    try {
      let renamed = 0;
      let errors = 0;
      const allEntries = found.flatMap(group => group.entries);
      
      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        setProgress(`Renaming ${i + 1} of ${allEntries.length}... (${entry.oldName} → ${entry.newName})`);
        
        try {
          await updateDoc(doc(db, 'job_time_entries', entry.id), {
            crewName: entry.newName,
            crewEmail: entry.oldName, // Keep original email for reference
            updatedAt: new Date().toISOString(),
            migratedFrom: entry.oldName,
            migratedAt: new Date().toISOString(),
          });
          console.log(`✅ Renamed: ${entry.id} (${entry.oldName} → ${entry.newName})`);
          renamed++;
        } catch (err) {
          console.error(`❌ Error renaming ${entry.id}:`, err);
          errors++;
        }
      }
      
      setResults({ renamed, errors });
      setPhase('complete');
      setProgress('Migration complete!');
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ MIGRATION COMPLETE');
      console.log(`Renamed: ${renamed} entries`);
      console.log(`Errors: ${errors}`);
      console.log('='.repeat(70));
      
    } catch (err) {
      console.error('Fatal error:', err);
      setError(err.message);
      setPhase('scanned');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: 'warning.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BuildIcon sx={{ mr: 1, fontSize: 30 }} />
        <Typography variant="h5" fontWeight="bold">
          🔧 Employee Name Migration
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          One-time migration: Rename email addresses to employee names
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          ✅ Looks up names from "users" collection
          <br />
          ✅ Renames time entries (e.g., leebone91@gmail.com → Chris Lee)
          <br />
          ✅ Preserves original email in "crewEmail" field
        </Typography>
      </Alert>

      {/* Ready */}
      {phase === 'ready' && (
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<BuildIcon />}
          onClick={scanEntries}
        >
          Step 1: Scan Time Entries
        </Button>
      )}

      {/* Scanning */}
      {phase === 'scanning' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2">{progress}</Typography>
        </Box>
      )}

      {/* Scanned - show results */}
      {phase === 'scanned' && found && (
        <>
          {found.length === 0 && (
            <Alert severity="success">
              ✅ No email entries found! All time entries already have proper employee names.
            </Alert>
          )}

          {found.length > 0 && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Found {found.reduce((sum, g) => sum + g.count, 0)} entries to rename:
                </Typography>
              </Alert>

              <List dense>
                {found.map((group, idx) => (
                  <ListItem key={idx} sx={{ bgcolor: 'background.paper', mb: 1, borderRadius: 1 }}>
                    <ListItemText
                      primary={`${group.oldName} → ${group.newName}`}
                      secondary={`${group.count} time entries`}
                    />
                  </ListItem>
                ))}
              </List>

              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<BuildIcon />}
                onClick={renameEntries}
                sx={{ mt: 2 }}
              >
                Step 2: Rename {found.reduce((sum, g) => sum + g.count, 0)} Entries
              </Button>
            </>
          )}
        </>
      )}

      {/* Renaming */}
      {phase === 'renaming' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2">{progress}</Typography>
        </Box>
      )}

      {/* Complete */}
      {phase === 'complete' && results && (
        <>
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              🎉 Migration Complete!
            </Typography>
            <Typography variant="body2">
              <strong>✅ Renamed: {results.renamed} entries</strong>
              <br />
              <strong>❌ Errors: {results.errors}</strong>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              🎯 Next Steps:
            </Typography>
            <Typography variant="body2">
              1. Remove this migration tool from Dashboard
              <br />
              2. All other components will now show employee names!
              <br />
              3. Time Clock, Job Scheduling, and Payroll are ready to use
            </Typography>
          </Alert>
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}
    </Paper>
  );
}

export default EmployeeNameMigration;