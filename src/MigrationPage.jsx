import React, { useState } from 'react';
import { Container, Paper, Button, Typography, Box, Alert } from '@mui/material';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { migrateDocumentsWithTokens } from './utils/migrateTokens';
import Swal from 'sweetalert2';

export default function MigrationPage() {
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState(null);

  const handleMigration = async () => {
    const confirmed = await Swal.fire({
      title: '🔐 Migrate Security Tokens?',
      html: `
        <p>This will add security tokens to all existing:</p>
        <ul style="text-align: left; margin: 20px auto; max-width: 300px;">
          <li>Bids</li>
          <li>Contracts</li>
          <li>Invoices</li>
        </ul>
        <p><strong>This is safe and won't break anything!</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, migrate now!',
    });

    if (!confirmed.isConfirmed) return;

    setMigrating(true);

    try {
      const migrationResults = await migrateDocumentsWithTokens();
      setResults(migrationResults);
      
      await Swal.fire({
        icon: 'success',
        title: '✅ Migration Complete!',
        html: `
          <div style="text-align: left; margin: 20px auto; max-width: 400px;">
            <p><strong>Security tokens added:</strong></p>
            <ul>
              <li><strong>Bids:</strong> ${migrationResults.bids.updated} of ${migrationResults.bids.total} updated</li>
              <li><strong>Contracts:</strong> ${migrationResults.contracts.updated} of ${migrationResults.contracts.total} updated</li>
              <li><strong>Invoices:</strong> ${migrationResults.invoices.updated} of ${migrationResults.invoices.total} updated</li>
            </ul>
            <p style="margin-top: 20px; color: green;">
              🔐 All documents are now secure!
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Migration error:', error);
      Swal.fire('Error', 'Migration failed: ' + error.message, 'error');
    } finally {
      setMigrating(false);
    }
  };

  const backfillJobTimestamps = async () => {
    const confirmed = await Swal.fire({
      title: '📅 Backfill Job Timestamps?',
      html: `
        <p>This will add <code>createdAt</code> timestamps to all jobs that don't have them.</p>
        <p><strong>How it works:</strong></p>
        <ul style="text-align: left; margin: 20px auto; max-width: 400px;">
          <li>Uses existing <code>startDate</code> if available</li>
          <li>Falls back to <code>completionDate</code> if no start date</li>
          <li>Uses current date as last resort</li>
        </ul>
        <p style="color: green;"><strong>✅ Safe - won't affect existing data</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, backfill now!',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setMigrating(true);
      console.log("🔧 Starting job timestamp backfill...");

      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`📋 Found ${jobs.length} jobs`);

      let updatedCount = 0;
      let skippedCount = 0;

      for (const job of jobs) {
        if (job.createdAt) {
          skippedCount++;
          continue;
        }

        const fallbackDate = job.startDate || job.completionDate || job.serviceDate || new Date().toISOString();
        
        await updateDoc(doc(db, "jobs", job.id), {
          createdAt: fallbackDate,
        });

        updatedCount++;
        console.log(`✅ Updated job ${job.id} (${job.clientName}) with createdAt: ${fallbackDate}`);
      }

      console.log(`✅ Migration complete! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
      
      await Swal.fire({
        icon: "success",
        title: "✅ Timestamp Migration Complete!",
        html: `
          <div style="text-align: left; margin: 20px auto; max-width: 400px;">
            <p><strong>Results:</strong></p>
            <ul>
              <li><strong>Jobs Updated:</strong> ${updatedCount}</li>
              <li><strong>Already Had Timestamps:</strong> ${skippedCount}</li>
              <li><strong>Total Jobs:</strong> ${jobs.length}</li>
            </ul>
            <p style="margin-top: 20px; color: green;">
              🎉 All jobs now have proper timestamps for sorting!
            </p>
          </div>
        `,
      });

    } catch (error) {
      console.error("❌ Migration error:", error);
      Swal.fire("Error", `Migration failed: ${error.message}`, "error");
    } finally {
      setMigrating(false);
    }
  };

  const backfillJobMetadata = async () => {
    const confirmed = await Swal.fire({
      title: '📝 Backfill Job Metadata?',
      html: `
        <p>This will add missing data to old jobs:</p>
        <ul style="text-align: left; margin: 20px auto; max-width: 400px;">
          <li><code>serviceDate</code> from startDate/completionDate</li>
          <li><code>jobType</code> from job description</li>
        </ul>
        <p style="color: green;"><strong>✅ Safe - won't affect existing data</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, backfill now!',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setMigrating(true);
      console.log("🔧 Starting job metadata backfill...");

      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`📋 Found ${jobs.length} jobs`);

      let updatedCount = 0;
      let skippedCount = 0;

      for (const job of jobs) {
        let updates = {};
        let needsUpdate = false;

        if (!job.serviceDate) {
          updates.serviceDate = job.startDate || job.completionDate || job.createdAt;
          needsUpdate = true;
        }

        if (!job.jobType) {
          const description = (job.description || job.notes || job.jobDescription || "").toLowerCase();
          
          if (description.includes("weed") || description.includes("spraying")) {
            updates.jobType = "Quick Weed Service";
          } else if (description.includes("maintenance")) {
            updates.jobType = "Maintenance";
          } else {
            updates.jobType = "General Service";
          }
          needsUpdate = true;
        }

        if (needsUpdate) {
          await updateDoc(doc(db, "jobs", job.id), updates);
          updatedCount++;
          console.log(`✅ Updated job ${job.id} (${job.clientName}) - Added: ${Object.keys(updates).join(', ')}`);
        } else {
          skippedCount++;
        }
      }

      console.log(`✅ Migration complete! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
      
      await Swal.fire({
        icon: "success",
        title: "✅ Metadata Migration Complete!",
        html: `
          <div style="text-align: left; margin: 20px auto; max-width: 400px;">
            <p><strong>Results:</strong></p>
            <ul>
              <li><strong>Jobs Updated:</strong> ${updatedCount}</li>
              <li><strong>Already Complete:</strong> ${skippedCount}</li>
              <li><strong>Total Jobs:</strong> ${jobs.length}</li>
            </ul>
            <p style="margin-top: 20px; color: green;">
              🎉 All jobs now have dates and job types!
            </p>
          </div>
        `,
      });

    } catch (error) {
      console.error("❌ Migration error:", error);
      Swal.fire("Error", `Migration failed: ${error.message}`, "error");
    } finally {
      setMigrating(false);
    }
  };

  const backfillQuickWeedNotes = async () => {
    const confirmed = await Swal.fire({
      title: '📝 Backfill Quick Weed Job Notes?',
      html: `
        <p>This will add detailed notes to Quick Weed Service jobs that don't have them.</p>
        <p style="color: green;"><strong>✅ Safe operation</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, backfill now!',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setMigrating(true);
      console.log("🔧 Starting Quick Weed notes backfill...");

      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let updatedCount = 0;
      let skippedCount = 0;

      for (const job of jobs) {
        if (job.jobType === "Quick Weed Service" && (!job.notes || job.notes === "Quick weed spraying job - auto-created from invoice")) {
          const notes = job.description 
            ? `Quick weed spraying job - auto-created from invoice\n\nServices Provided:\n${job.description}`
            : "Quick weed spraying job - auto-created from invoice";

          await updateDoc(doc(db, "jobs", job.id), {
            notes: notes,
          });

          updatedCount++;
          console.log(`✅ Updated job ${job.id} (${job.clientName})`);
        } else {
          skippedCount++;
        }
      }

      await Swal.fire({
        icon: "success",
        title: "✅ Notes Backfill Complete!",
        html: `
          <p><strong>Results:</strong></p>
          <ul>
            <li><strong>Jobs Updated:</strong> ${updatedCount}</li>
            <li><strong>Skipped:</strong> ${skippedCount}</li>
          </ul>
        `,
      });

    } catch (error) {
      console.error("❌ Migration error:", error);
      Swal.fire("Error", `Migration failed: ${error.message}`, "error");
    } finally {
      setMigrating(false);
    }
  };

  const manualFixQuickWeedJobs = async () => {
    const confirmed = await Swal.fire({
      title: '🛠️ Manual Fix - Quick Weed Jobs?',
      html: `
        <p>This will mark ALL jobs with "Quick weed spraying job - auto-created from invoice" as Quick Weed Service.</p>
        <p style="color: orange;"><strong>⚠️ Manual fix based on job notes</strong></p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, fix them!',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setMigrating(true);
      console.log("🛠️ Manual fix for Quick Weed jobs...");

      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let fixedCount = 0;

      for (const job of jobs) {
        const notes = job.notes || "";
        const description = job.description || "";
        
        // If notes or description contains the Quick Weed identifier
        if (notes.includes("Quick weed spraying job - auto-created from invoice") || 
            description.includes("Weed Control Services:")) {
          
          await updateDoc(doc(db, "jobs", job.id), {
            jobType: "Quick Weed Service",
            invoiceSource: "quick-weed-invoice",
          });
          
          fixedCount++;
          console.log(`✅ Fixed job ${job.id} (${job.clientName})`);
        }
      }

      await Swal.fire({
        icon: "success",
        title: "✅ Manual Fix Complete!",
        html: `
          <p><strong>Quick Weed Jobs Fixed:</strong> ${fixedCount}</p>
        `,
      });

    } catch (error) {
      console.error("❌ Fix error:", error);
      Swal.fire("Error", `Fix failed: ${error.message}`, "error");
    } finally {
      setMigrating(false);
    }
  };

  const nuclearResetJobTypes = async () => {
    const confirmed = await Swal.fire({
      title: '💣 Nuclear Reset - Job Types?',
      html: `
        <p><strong>This will do a complete reset:</strong></p>
        <ol style="text-align: left; margin: 20px auto; max-width: 400px;">
          <li>Set ALL jobs to "General Service"</li>
          <li>Then ONLY mark jobs as "Quick Weed Service" if they have "Weed Control Services:" in their description</li>
          <li>Mark jobs as "Maintenance" if they have maintenance contract links</li>
        </ol>
        <p style="color: red;"><strong>⚠️ This is a complete reset</strong></p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, do the nuclear reset!',
      confirmButtonColor: '#d33',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setMigrating(true);
      console.log("💣 Starting nuclear reset...");

      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`📋 Found ${jobs.length} jobs to reset`);

      let resetCount = 0;
      let quickWeedCount = 0;
      let maintenanceCount = 0;
      let generalCount = 0;

      for (const job of jobs) {
        const description = job.description || "";
        const notes = job.notes || "";
        const jobDescription = job.jobDescription || "";
        
        let newJobType = "General Service";
        let updates = { jobType: "General Service" };

        // Check if it's a Quick Weed job
        if (description.includes("Weed Control Services:") || 
            (notes.includes("Quick weed spraying job") && notes.includes("auto-created from invoice"))) {
          newJobType = "Quick Weed Service";
          updates.jobType = "Quick Weed Service";
          updates.invoiceSource = "quick-weed-invoice";
          quickWeedCount++;
        }
        // Check if it's a Maintenance job
        else if (job.maintenanceContractId || 
                 description.toLowerCase().includes("maintenance") ||
                 notes.toLowerCase().includes("maintenance visit") ||
                 jobDescription.toLowerCase().includes("maintenance")) {
          newJobType = "Maintenance";
          updates.jobType = "Maintenance";
          maintenanceCount++;
        }
        else {
          generalCount++;
        }

        await updateDoc(doc(db, "jobs", job.id), updates);
        resetCount++;
        
        console.log(`✅ Job ${job.id} (${job.clientName}) → ${newJobType}`);
      }

      await Swal.fire({
        icon: "success",
        title: "✅ Nuclear Reset Complete!",
        html: `
          <div style="text-align: left; margin: 20px auto; max-width: 400px;">
            <p><strong>Results:</strong></p>
            <ul>
              <li><strong>Total Jobs Processed:</strong> ${resetCount}</li>
              <li><strong>Quick Weed Service:</strong> ${quickWeedCount}</li>
              <li><strong>Maintenance:</strong> ${maintenanceCount}</li>
              <li><strong>General Service:</strong> ${generalCount}</li>
            </ul>
            <p style="margin-top: 20px; color: green;">
              🎉 All jobs are now properly categorized!
            </p>
          </div>
        `,
      });

    } catch (error) {
      console.error("❌ Nuclear reset error:", error);
      Swal.fire("Error", `Reset failed: ${error.message}`, "error");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          🔧 Database Migrations
        </Typography>
        
        <Typography variant="body1" paragraph>
          Run one-time database migrations to fix and upgrade your data.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          These are safe operations that won't delete or break existing data.
        </Alert>

        {/* Security Token Migration */}
        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom>
            🔐 Security Token Migration
          </Typography>
          <Typography variant="body2" paragraph>
            Add security tokens to all existing bids, contracts, and invoices
            that don't have them yet. New documents will automatically get tokens.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleMigration}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Migrating...' : 'Migrate Security Tokens'}
          </Button>

          {results && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="h6">Migration Results:</Typography>
              <Typography>✅ Bids: {results.bids.updated} of {results.bids.total} updated</Typography>
              <Typography>✅ Contracts: {results.contracts.updated} of {results.contracts.total} updated</Typography>
              <Typography>✅ Invoices: {results.invoices.updated} of {results.invoices.total} updated</Typography>
            </Box>
          )}
        </Box>

        {/* Job Timestamp Migration */}
        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom>
            📅 Job Timestamp Migration
          </Typography>
          <Typography variant="body2" paragraph>
            Add <code>createdAt</code> timestamps to all jobs for proper sorting.
            Uses existing dates (startDate, completionDate) when available.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            onClick={backfillJobTimestamps}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Migrating...' : 'Backfill Job Timestamps'}
          </Button>
        </Box>

        {/* Job Metadata Migration */}
        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom>
            📝 Job Metadata Migration
          </Typography>
          <Typography variant="body2" paragraph>
            Add missing <code>serviceDate</code> and <code>jobType</code> to old jobs.
            Automatically detects job type from description (Weed Service, Maintenance, General).
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={backfillJobMetadata}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Migrating...' : 'Backfill Job Metadata'}
          </Button>
        </Box>

        {/* Quick Weed Notes Migration */}
        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom>
            📝 Quick Weed Notes Migration
          </Typography>
          <Typography variant="body2" paragraph>
            Add detailed service notes to Quick Weed Service jobs that are missing them.
          </Typography>
          <Button
            variant="contained"
            color="info"
            size="large"
            onClick={backfillQuickWeedNotes}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Migrating...' : 'Backfill Quick Weed Notes'}
          </Button>
        </Box>

        {/* Manual Fix Quick Weed Jobs */}
        <Box sx={{ mb: 4, p: 3, border: '2px solid #f44336', borderRadius: 2, bgcolor: '#ffebee' }}>
          <Typography variant="h5" gutterBottom>
            🛠️ Manual Fix - Quick Weed Jobs
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Use this to manually restore Quick Weed jobs.</strong><br/>
            Marks any job with "Quick weed spraying job - auto-created from invoice" as Quick Weed Service.
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={manualFixQuickWeedJobs}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Fixing...' : 'Manual Fix Quick Weed Jobs'}
          </Button>
        </Box>

        {/* Nuclear Reset Job Types */}
        <Box sx={{ mb: 4, p: 3, border: '3px solid #d32f2f', borderRadius: 2, bgcolor: '#ffebee' }}>
          <Typography variant="h5" gutterBottom color="error">
            💣 Nuclear Reset - Job Types
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>⚠️ COMPLETE RESET:</strong><br/>
            This will intelligently categorize ALL jobs:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 3, mb: 2 }}>
            <li>Quick Weed Service (based on invoice descriptions)</li>
            <li>Maintenance (based on contract links)</li>
            <li>General Service (everything else)</li>
          </Box>
          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={nuclearResetJobTypes}
            disabled={migrating}
            fullWidth
          >
            {migrating ? 'Resetting...' : '💣 Nuclear Reset Job Types'}
          </Button>
        </Box>

        <Alert severity="warning" sx={{ mt: 3 }}>
          <strong>Note:</strong> Only run each migration once. Running multiple times won't cause issues, 
          but it will skip documents that already have the required data.
        </Alert>
      </Paper>
    </Container>
  );
}