import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Merge as MergeIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Undo as UndoIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function MigrationDashboard() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Data state
  const [schedules, setSchedules] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Issue tracking
  const [criticalIssues, setCriticalIssues] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [deletableItems, setDeletableItems] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    critical: 0,
    warnings: 0,
    healthy: 0,
    total: 0,
  });
  
  // Dialog state
  const [detailsDialog, setDetailsDialog] = useState({ open: false, issue: null });
  const [skipDialog, setSkipDialog] = useState({ open: false, issue: null });
  const [skipNote, setSkipNote] = useState('');
  const [legacyDate, setLegacyDate] = useState('2026-02-07');

  useEffect(() => {
    runAudit();
  }, []);

  // ==================== DATA LOADING ====================
  
  const runAudit = async () => {
    setScanning(true);
    try {
      console.log('🔍 Starting data audit...');
      
      // Load all collections
      const [schedulesSnap, customersSnap, contractsSnap, invoicesSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, 'schedules')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'contracts')),
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'payments')),
      ]);
      
      const schedulesData = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const customersData = customersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const contractsData = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const invoicesData = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const paymentsData = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setSchedules(schedulesData);
      setCustomers(customersData);
      setContracts(contractsData);
      setInvoices(invoicesData);
      setPayments(paymentsData);
      
      console.log('📊 Data loaded:', {
        schedules: schedulesData.length,
        customers: customersData.length,
        contracts: contractsData.length,
        invoices: invoicesData.length,
        payments: paymentsData.length,
      });
      
      // Run analysis
      await analyzeData(schedulesData, customersData, contractsData, invoicesData, paymentsData);
      
    } catch (error) {
      console.error('Error running audit:', error);
      Swal.fire('Error', 'Failed to run audit. Check console.', 'error');
    } finally {
      setScanning(false);
    }
  };

  // ==================== DATA ANALYSIS ====================
  
  const analyzeData = async (schedulesData, customersData, contractsData, invoicesData, paymentsData) => {
    console.log('🔬 Analyzing data...');
    
    const critical = [];
    const warns = [];
    const deletable = [];
    const dupes = [];
    
    // ========== CRITICAL CHECKS ==========
    
    // 1. Schedules with no links
    schedulesData.forEach(schedule => {
      if (!schedule.customerId && !schedule.contractId && !schedule.invoiceId) {
        critical.push({
          type: 'ORPHANED_SCHEDULE',
          severity: 'critical',
          title: 'Schedule with no customer/contract link',
          data: schedule,
          collection: 'schedules',
          message: `Schedule for "${schedule.clientName}" has no link to customer, contract, or invoice`,
          fixes: [
            { label: 'Search for customer', action: 'search' },
            { label: 'Create new customer', action: 'create' },
            { label: 'Mark as legacy', action: 'legacy' },
            { label: 'Delete', action: 'delete' },
          ]
        });
      }
    });
    
    // 2. Payments with no invoice link
    paymentsData.forEach(payment => {
      if (!payment.invoiceId) {
        critical.push({
          type: 'ORPHANED_PAYMENT',
          severity: 'critical',
          title: 'Payment with no invoice link',
          data: payment,
          collection: 'payments',
          message: `Payment of $${payment.amount} has no invoice link`,
          fixes: [
            { label: 'Search for invoice', action: 'search' },
            { label: 'Create invoice', action: 'create' },
            { label: 'Mark as cash (no invoice)', action: 'mark-cash' },
            { label: 'Delete', action: 'delete' },
          ]
        });
      }
    });
    
    // 3. Invoices with no customer link
    invoicesData.forEach(invoice => {
      if (!invoice.customerId) {
        critical.push({
          type: 'ORPHANED_INVOICE',
          severity: 'critical',
          title: 'Invoice with no customer link',
          data: invoice,
          collection: 'invoices',
          message: `Invoice #${invoice.invoiceNumber || invoice.id} has no customer link`,
          fixes: [
            { label: 'Search for customer', action: 'search' },
            { label: 'Create customer', action: 'create' },
            { label: 'Delete', action: 'delete' },
          ]
        });
      }
    });
    
    // 4. Contracts with no customer link
    contractsData.forEach(contract => {
      if (!contract.customerId) {
        critical.push({
          type: 'ORPHANED_CONTRACT',
          severity: 'critical',
          title: 'Contract with no customer link',
          data: contract,
          collection: 'contracts',
          message: `Contract for "${contract.customerName}" has no customer ID`,
          fixes: [
            { label: 'Search for customer', action: 'search' },
            { label: 'Create customer', action: 'create' },
            { label: 'Delete', action: 'delete' },
          ]
        });
      }
    });
    
    // 5. Customers with no contact info
    customersData.forEach(customer => {
      if (!customer.phone && !customer.email) {
        critical.push({
          type: 'NO_CONTACT',
          severity: 'critical',
          title: 'Customer with no contact info',
          data: customer,
          collection: 'customers',
          message: `Customer "${customer.name}" has no phone or email`,
          fixes: [
            { label: 'Add contact info', action: 'edit' },
            { label: 'Delete if duplicate', action: 'delete' },
          ]
        });
      }
    });
    
    // 6. Invoices with $0 amount
    invoicesData.forEach(invoice => {
      if (!invoice.amount || invoice.amount === 0) {
        critical.push({
          type: 'ZERO_INVOICE',
          severity: 'critical',
          title: 'Invoice with $0 amount',
          data: invoice,
          collection: 'invoices',
          message: `Invoice #${invoice.invoiceNumber || invoice.id} has no amount`,
          fixes: [
            { label: 'Add amount', action: 'edit' },
            { label: 'Delete if test', action: 'delete' },
          ]
        });
      }
    });
    
    // 7. Schedules with no date
    schedulesData.forEach(schedule => {
      if (!schedule.startDate) {
        critical.push({
          type: 'NO_DATE',
          severity: 'critical',
          title: 'Schedule with no date',
          data: schedule,
          collection: 'schedules',
          message: `Schedule for "${schedule.clientName}" has no start date`,
          fixes: [
            { label: 'Add date', action: 'edit' },
            { label: 'Delete', action: 'delete' },
          ]
        });
      }
    });
    
    // ========== WARNING CHECKS ==========
    
    // 1. Unsigned contracts (>30 days old)
    contractsData.forEach(contract => {
      if (!contract.signedAt && contract.createdAt) {
        const daysSinceCreated = (Date.now() - new Date(contract.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated > 30) {
          warns.push({
            type: 'UNSIGNED_CONTRACT',
            severity: 'warning',
            title: 'Unsigned contract (>30 days old)',
            data: contract,
            collection: 'contracts',
            message: `Contract for "${contract.customerName}" created ${Math.floor(daysSinceCreated)} days ago but never signed`,
            fixes: [
              { label: 'Mark as signed (backdate)', action: 'sign' },
              { label: 'Mark as lost deal', action: 'mark-lost' },
              { label: 'Delete', action: 'delete' },
            ]
          });
        }
      }
    });
    
    // 2. Completed jobs with no invoice
    schedulesData.forEach(schedule => {
      if (schedule.status === 'completed' && !schedule.invoiceId) {
        warns.push({
          type: 'NO_INVOICE',
          severity: 'warning',
          title: 'Completed job with no invoice',
          data: schedule,
          collection: 'schedules',
          message: `Job for "${schedule.clientName}" completed but no invoice created`,
          fixes: [
            { label: 'Create invoice', action: 'create-invoice' },
            { label: 'Link existing invoice', action: 'link' },
            { label: 'Mark as no-charge', action: 'mark-free' },
          ]
        });
      }
    });
    
    // 3. Overdue invoices (>60 days)
    invoicesData.forEach(invoice => {
      if (invoice.status !== 'paid' && invoice.dueDate) {
        const daysOverdue = (Date.now() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24);
        if (daysOverdue > 60) {
          warns.push({
            type: 'OVERDUE_INVOICE',
            severity: 'warning',
            title: `Invoice overdue by ${Math.floor(daysOverdue)} days`,
            data: invoice,
            collection: 'invoices',
            message: `Invoice #${invoice.invoiceNumber || invoice.id} for "${invoice.customerName}" is ${Math.floor(daysOverdue)} days overdue`,
            fixes: [
              { label: 'Send reminder', action: 'send-reminder' },
              { label: 'Mark as paid', action: 'mark-paid' },
              { label: 'Write off', action: 'write-off' },
            ]
          });
        }
      }
    });
    
    // 4. Duplicate customer names
    const customersByName = {};
    customersData.forEach(customer => {
      const name = (customer.name || '').toLowerCase().trim();
      if (name) {
        if (!customersByName[name]) {
          customersByName[name] = [];
        }
        customersByName[name].push(customer);
      }
    });
    
    Object.entries(customersByName).forEach(([name, customers]) => {
      if (customers.length > 1) {
        dupes.push({
          type: 'DUPLICATE_CUSTOMER',
          severity: 'warning',
          title: `Duplicate customer: "${customers[0].name}"`,
          data: customers,
          collection: 'customers',
          message: `Found ${customers.length} customers with name "${customers[0].name}"`,
          fixes: [
            { label: 'Merge duplicates', action: 'merge' },
            { label: 'Keep separate', action: 'keep' },
          ]
        });
      }
    });
    
    // 5. Schedules with no employees
    schedulesData.forEach(schedule => {
      if (!schedule.assignedEmployees || schedule.assignedEmployees.length === 0) {
        warns.push({
          type: 'NO_EMPLOYEES',
          severity: 'warning',
          title: 'Schedule with no employees assigned',
          data: schedule,
          collection: 'schedules',
          message: `Schedule for "${schedule.clientName}" has no crew assigned`,
          fixes: [
            { label: 'Assign employees', action: 'assign' },
            { label: 'Mark as legacy', action: 'legacy' },
          ]
        });
      }
    });
    
    // 6. Jobs with no description
    schedulesData.forEach(schedule => {
      if (!schedule.jobDescription || schedule.jobDescription.trim() === '') {
        warns.push({
          type: 'NO_DESCRIPTION',
          severity: 'warning',
          title: 'Schedule with no job description',
          data: schedule,
          collection: 'schedules',
          message: `Schedule for "${schedule.clientName}" has no description of work`,
          fixes: [
            { label: 'Add description', action: 'edit' },
            { label: 'Mark as legacy', action: 'legacy' },
          ]
        });
      }
    });
    
    // 7. Customers with no address
    customersData.forEach(customer => {
      if (!customer.address) {
        warns.push({
          type: 'NO_ADDRESS',
          severity: 'warning',
          title: 'Customer with no address',
          data: customer,
          collection: 'customers',
          message: `Customer "${customer.name}" has no address`,
          fixes: [
            { label: 'Add address', action: 'edit' },
            { label: 'Skip (not critical)', action: 'skip' },
          ]
        });
      }
    });
    
    // ========== DELETABLE ITEMS ==========
    
    // Test data
    [...schedulesData, ...customersData, ...contractsData, ...invoicesData, ...paymentsData].forEach(item => {
      const name = (item.name || item.clientName || item.customerName || '').toLowerCase();
      const desc = (item.description || item.jobDescription || '').toLowerCase();
      const isTest = name.includes('test') || name.includes('demo') || desc.includes('test') || desc.includes('demo');
      const isLowAmount = item.amount === 1 || item.amount === 0.01;
      
      if (isTest || isLowAmount) {
        deletable.push({
          type: 'TEST_DATA',
          severity: 'info',
          title: 'Possible test data',
          data: item,
          collection: item.clientName ? 'schedules' : item.invoiceNumber ? 'invoices' : item.amount && !item.name ? 'payments' : item.customerName ? 'contracts' : 'customers',
          message: `${item.name || item.clientName || item.customerName || 'Item'} appears to be test data`,
          reason: isTest ? 'Contains "test" or "demo"' : 'Amount is $1 or $0.01',
        });
      }
    });
    
    // Update state
    setCriticalIssues(critical);
    setWarnings(warns);
    setDeletableItems(deletable);
    setDuplicates(dupes);
    
    // Calculate stats
    const totalRecords = schedulesData.length + customersData.length + contractsData.length + invoicesData.length + paymentsData.length;
    const issueCount = critical.length + warns.length;
    const healthyCount = totalRecords - issueCount;
    
    setStats({
      critical: critical.length,
      warnings: warns.length,
      healthy: healthyCount,
      total: totalRecords,
    });
    
    console.log('✅ Analysis complete:', {
      critical: critical.length,
      warnings: warns.length,
      deletable: deletable.length,
      duplicates: dupes.length,
    });
  };

  // ==================== ACTIONS ====================
  
  const handleDeleteItem = async (issue) => {
    const result = await Swal.fire({
      title: 'Delete this item?',
      text: 'This cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#d33',
    });
    
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, issue.collection, issue.data.id));
        
        // Log activity
        logActivity(`Deleted ${issue.collection} item: ${issue.data.name || issue.data.clientName || issue.data.id}`);
        
        // Remove from issues list
        if (issue.severity === 'critical') {
          setCriticalIssues(prev => prev.filter(i => i.data.id !== issue.data.id));
        } else {
          setWarnings(prev => prev.filter(i => i.data.id !== issue.data.id));
        }
        
        Swal.fire('Deleted!', 'Item has been deleted.', 'success');
        
        // Refresh audit
        runAudit();
      } catch (error) {
        console.error('Error deleting:', error);
        Swal.fire('Error', 'Failed to delete item', 'error');
      }
    }
  };
  
  const handleMarkAsLegacy = async (issue) => {
    try {
      await updateDoc(doc(db, issue.collection, issue.data.id), {
        isLegacy: true,
        legacyMarkedAt: new Date().toISOString(),
      });
      
      logActivity(`Marked as legacy: ${issue.collection}/${issue.data.id}`);
      
      Swal.fire('Success!', 'Marked as legacy', 'success');
      runAudit();
    } catch (error) {
      console.error('Error marking legacy:', error);
      Swal.fire('Error', 'Failed to mark as legacy', 'error');
    }
  };
  
  const handleSkipWithNote = () => {
    if (!skipNote.trim()) {
      Swal.fire('Note required', 'Please add a note explaining why you\'re skipping this', 'warning');
      return;
    }
    
    logActivity(`Skipped ${skipDialog.issue?.type}: ${skipNote}`);
    
    // Remove from list
    if (skipDialog.issue?.severity === 'critical') {
      setCriticalIssues(prev => prev.filter(i => i.data.id !== skipDialog.issue.data.id));
    } else {
      setWarnings(prev => prev.filter(i => i.data.id !== skipDialog.issue.data.id));
    }
    
    setSkipDialog({ open: false, issue: null });
    setSkipNote('');
    
    Swal.fire('Skipped', 'Issue marked as reviewed', 'info');
  };
  
  const handleMarkAllAsLegacy = async () => {
    const result = await Swal.fire({
      title: 'Mark all data before this date as legacy?',
      html: `
        <p>Cutoff date: <strong>${legacyDate}</strong></p>
        <p>This will mark:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>${schedules.length} Schedules</li>
          <li>${invoices.length} Invoices</li>
          <li>${contracts.length} Contracts</li>
          <li>${customers.length} Customers</li>
          <li>${payments.length} Payments</li>
        </ul>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark as legacy',
    });
    
    if (result.isConfirmed) {
      setLoading(true);
      try {
        const cutoff = new Date(legacyDate);
        const batch = writeBatch(db);
        let count = 0;
        
        // Mark all collections
        const allCollections = [
          { name: 'schedules', data: schedules },
          { name: 'invoices', data: invoices },
          { name: 'contracts', data: contracts },
          { name: 'customers', data: customers },
          { name: 'payments', data: payments },
        ];
        
        for (const coll of allCollections) {
          for (const item of coll.data) {
            const itemDate = new Date(item.createdAt || item.date || item.startDate || 0);
            if (itemDate < cutoff) {
              const docRef = doc(db, coll.name, item.id);
              batch.update(docRef, {
                isLegacy: true,
                legacyMarkedAt: new Date().toISOString(),
                legacyCutoffDate: legacyDate,
              });
              count++;
            }
          }
        }
        
        await batch.commit();
        
        logActivity(`Marked ${count} items as legacy (cutoff: ${legacyDate})`);
        
        Swal.fire('Success!', `Marked ${count} items as legacy`, 'success');
        runAudit();
      } catch (error) {
        console.error('Error marking legacy:', error);
        Swal.fire('Error', 'Failed to mark items as legacy', 'error');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleDeleteTestData = async () => {
    const testItems = deletableItems.filter(item => item.type === 'TEST_DATA');
    
    const result = await Swal.fire({
      title: `Delete ${testItems.length} test items?`,
      text: 'This will permanently delete all detected test data.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete all',
      confirmButtonColor: '#d33',
    });
    
    if (result.isConfirmed) {
      setLoading(true);
      try {
        const batch = writeBatch(db);
        
        for (const item of testItems) {
          const docRef = doc(db, item.collection, item.data.id);
          batch.delete(docRef);
        }
        
        await batch.commit();
        
        logActivity(`Deleted ${testItems.length} test data items`);
        
        Swal.fire('Deleted!', `Removed ${testItems.length} test items`, 'success');
        runAudit();
      } catch (error) {
        console.error('Error deleting test data:', error);
        Swal.fire('Error', 'Failed to delete test data', 'error');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const logActivity = (message) => {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      user: 'admin', // You can get from auth context
    };
    setActivityLog(prev => [entry, ...prev]);
  };
  
  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      stats,
      criticalIssues: criticalIssues.length,
      warnings: warnings.length,
      deletableItems: deletableItems.length,
      duplicates: duplicates.length,
      details: {
        critical: criticalIssues,
        warnings,
        deletable: deletableItems,
        duplicates,
      },
      activityLog,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    Swal.fire('Exported!', 'Report downloaded', 'success');
  };

  // ==================== RENDER ====================

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f7fa', pb: 6 }}>
      {/* Header */}
      <Paper 
        elevation={3} 
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white', 
          p: 3,
          mb: 3,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                🔧 Migration Control Center
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Data integrity audit and cleanup tool
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={scanning ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <RefreshIcon />}
                onClick={runAudit}
                disabled={scanning}
                sx={{ 
                  backgroundColor: 'white', 
                  color: '#667eea',
                  '&:hover': { backgroundColor: '#f5f5f5' }
                }}
              >
                {scanning ? 'Scanning...' : 'Refresh Audit'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportReport}
                sx={{ 
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Export Report
              </Button>
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="xl">
        {/* Stats Dashboard */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats.critical}
                    </Typography>
                    <Typography variant="body2">Critical Issues</Typography>
                  </Box>
                  <ErrorIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #ff5722 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats.warnings}
                    </Typography>
                    <Typography variant="body2">Warnings</Typography>
                  </Box>
                  <WarningIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats.healthy}
                    </Typography>
                    <Typography variant="body2">Healthy Records</Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #03a9f4 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats.total}
                    </Typography>
                    <Typography variant="body2">Total Records</Typography>
                  </Box>
                  <InfoIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        {scanning && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
          </Box>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={`Dashboard`} />
            <Tab label={`Critical (${stats.critical})`} icon={<ErrorIcon />} iconPosition="start" />
            <Tab label={`Warnings (${stats.warnings})`} icon={<WarningIcon />} iconPosition="start" />
            <Tab label={`Duplicates (${duplicates.length})`} icon={<MergeIcon />} iconPosition="start" />
            <Tab label={`Cleanup (${deletableItems.length})`} icon={<DeleteIcon />} iconPosition="start" />
            <Tab label="Legacy Mode" />
            <Tab label={`Activity Log (${activityLog.length})`} />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <Paper sx={{ p: 3, minHeight: 400 }}>
          {/* TAB 0: DASHBOARD */}
          {currentTab === 0 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                📊 Data Health Overview
              </Typography>
              
              {stats.critical === 0 && stats.warnings === 0 ? (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>All Clear! 🎉</AlertTitle>
                  Your data is healthy with no critical issues or warnings detected.
                </Alert>
              ) : (
                <>
                  {stats.critical > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <AlertTitle>Action Required</AlertTitle>
                      You have {stats.critical} critical issue{stats.critical > 1 ? 's' : ''} that must be fixed before production deployment.
                    </Alert>
                  )}
                  
                  {stats.warnings > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <AlertTitle>Review Recommended</AlertTitle>
                      You have {stats.warnings} warning{stats.warnings > 1 ? 's' : ''} that should be reviewed.
                    </Alert>
                  )}
                </>
              )}
              
              <Grid container spacing={2} sx={{ mt: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                        Collections Summary
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText primary="Schedules" secondary={schedules.length} />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Customers" secondary={customers.length} />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Contracts" secondary={contracts.length} />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Invoices" secondary={invoices.length} />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Payments" secondary={payments.length} />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                        Quick Actions
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {stats.critical > 0 && (
                          <Button 
                            variant="contained" 
                            color="error"
                            onClick={() => setCurrentTab(1)}
                          >
                            View Critical Issues ({stats.critical})
                          </Button>
                        )}
                        {stats.warnings > 0 && (
                          <Button 
                            variant="contained" 
                            color="warning"
                            onClick={() => setCurrentTab(2)}
                          >
                            View Warnings ({stats.warnings})
                          </Button>
                        )}
                        {duplicates.length > 0 && (
                          <Button 
                            variant="outlined"
                            onClick={() => setCurrentTab(3)}
                          >
                            Review Duplicates ({duplicates.length})
                          </Button>
                        )}
                        {deletableItems.length > 0 && (
                          <Button 
                            variant="outlined"
                            color="error"
                            onClick={() => setCurrentTab(4)}
                          >
                            Cleanup Test Data ({deletableItems.length})
                          </Button>
                        )}
                        <Button 
                          variant="outlined"
                          onClick={() => setCurrentTab(5)}
                        >
                          Mark as Legacy
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* TAB 1: CRITICAL ISSUES */}
          {currentTab === 1 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#f44336' }}>
                🔴 Critical Issues
              </Typography>
              
              {criticalIssues.length === 0 ? (
                <Alert severity="success">
                  <AlertTitle>No Critical Issues! 🎉</AlertTitle>
                  All your data meets the critical requirements.
                </Alert>
              ) : (
                <Box>
                  {criticalIssues.map((issue, index) => (
                    <Accordion key={index} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <ErrorIcon color="error" />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {issue.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {issue.message}
                            </Typography>
                          </Box>
                          <Chip label={issue.type} size="small" color="error" variant="outlined" />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* Data Preview */}
                          <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                              Data Preview:
                            </Typography>
                            <pre style={{ fontSize: '0.75rem', margin: 0, overflow: 'auto' }}>
                              {JSON.stringify(issue.data, null, 2)}
                            </pre>
                          </Box>
                          
                          {/* Suggested Fixes */}
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              💡 Suggested Fixes:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {issue.fixes.map((fix, idx) => (
                                <Button
                                  key={idx}
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    if (fix.action === 'delete') {
                                      handleDeleteItem(issue);
                                    } else if (fix.action === 'legacy') {
                                      handleMarkAsLegacy(issue);
                                    } else {
                                      Swal.fire('Coming Soon', `${fix.label} feature is under development`, 'info');
                                    }
                                  }}
                                >
                                  {fix.label}
                                </Button>
                              ))}
                              <Button
                                variant="outlined"
                                size="small"
                                color="secondary"
                                onClick={() => setSkipDialog({ open: true, issue })}
                              >
                                Skip with Note
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* TAB 2: WARNINGS */}
          {currentTab === 2 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#ff9800' }}>
                🟡 Warnings
              </Typography>
              
              {warnings.length === 0 ? (
                <Alert severity="success">
                  <AlertTitle>No Warnings!</AlertTitle>
                  Your data quality looks good.
                </Alert>
              ) : (
                <Box>
                  {warnings.map((issue, index) => (
                    <Accordion key={index} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <WarningIcon color="warning" />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {issue.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {issue.message}
                            </Typography>
                          </Box>
                          <Chip label={issue.type} size="small" color="warning" variant="outlined" />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ backgroundColor: '#fff3e0', p: 2, borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                              Data Preview:
                            </Typography>
                            <pre style={{ fontSize: '0.75rem', margin: 0, overflow: 'auto' }}>
                              {JSON.stringify(issue.data, null, 2)}
                            </pre>
                          </Box>
                          
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              💡 Suggested Fixes:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {issue.fixes.map((fix, idx) => (
                                <Button
                                  key={idx}
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    if (fix.action === 'delete') {
                                      handleDeleteItem(issue);
                                    } else if (fix.action === 'legacy') {
                                      handleMarkAsLegacy(issue);
                                    } else {
                                      Swal.fire('Coming Soon', `${fix.label} feature is under development`, 'info');
                                    }
                                  }}
                                >
                                  {fix.label}
                                </Button>
                              ))}
                              <Button
                                variant="outlined"
                                size="small"
                                color="secondary"
                                onClick={() => setSkipDialog({ open: true, issue })}
                              >
                                Skip with Note
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* TAB 3: DUPLICATES */}
          {currentTab === 3 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                🔄 Duplicate Customers
              </Typography>
              
              {duplicates.length === 0 ? (
                <Alert severity="success">
                  <AlertTitle>No Duplicates Detected!</AlertTitle>
                  All customer names are unique.
                </Alert>
              ) : (
                <Box>
                  {duplicates.map((dup, index) => (
                    <Card key={index} sx={{ mb: 2 }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                          {dup.title}
                        </Typography>
                        
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {dup.data.map((customer) => (
                                <TableRow key={customer.id}>
                                  <TableCell>{customer.id.substring(0, 8)}...</TableCell>
                                  <TableCell>{customer.name}</TableCell>
                                  <TableCell>{customer.phone || '—'}</TableCell>
                                  <TableCell>{customer.email || '—'}</TableCell>
                                  <TableCell>{customer.address || '—'}</TableCell>
                                  <TableCell align="right">
                                    <Button size="small" variant="outlined">
                                      Keep This
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button 
                            variant="contained" 
                            startIcon={<MergeIcon />}
                            onClick={() => Swal.fire('Coming Soon', 'Merge feature is under development', 'info')}
                          >
                            Merge Duplicates
                          </Button>
                          <Button 
                            variant="outlined"
                            onClick={() => Swal.fire('Marked', 'These are different customers', 'success')}
                          >
                            Keep Separate
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* TAB 4: CLEANUP */}
          {currentTab === 4 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                🗑️ Cleanup Test Data
              </Typography>
              
              {deletableItems.length === 0 ? (
                <Alert severity="success">
                  <AlertTitle>No Test Data Detected!</AlertTitle>
                  Your database appears clean.
                </Alert>
              ) : (
                <Box>
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <AlertTitle>Found {deletableItems.length} items that appear to be test data</AlertTitle>
                    Review carefully before deleting. This action cannot be undone!
                  </Alert>
                  
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteTestData}
                    sx={{ mb: 3 }}
                  >
                    Delete All Test Data ({deletableItems.length} items)
                  </Button>
                  
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Name/Description</TableCell>
                          <TableCell>Reason</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deletableItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip label={item.collection} size="small" />
                            </TableCell>
                            <TableCell>
                              {item.data.name || item.data.clientName || item.data.customerName || item.data.id}
                            </TableCell>
                            <TableCell>{item.reason}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}

          {/* TAB 5: LEGACY MODE */}
          {currentTab === 5 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                🔶 Mark Data as Legacy
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>What is Legacy Mode?</AlertTitle>
                Mark all data before a cutoff date as "legacy" to bypass strict validation rules.
                Legacy data will show a 🔶 badge and can still be viewed/edited.
              </Alert>
              
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Select Cutoff Date
                  </Typography>
                  
                  <TextField
                    type="date"
                    value={legacyDate}
                    onChange={(e) => setLegacyDate(e.target.value)}
                    fullWidth
                    sx={{ mb: 3 }}
                    label="Mark all data before this date as legacy"
                    InputLabelProps={{ shrink: true }}
                  />
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    This will mark approximately:
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemText primary={`${schedules.length} Schedules`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary={`${invoices.length} Invoices`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary={`${contracts.length} Contracts`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary={`${customers.length} Customers`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary={`${payments.length} Payments`} />
                    </ListItem>
                  </List>
                  
                  <Button
                    variant="contained"
                    onClick={handleMarkAllAsLegacy}
                    disabled={loading}
                    sx={{ mt: 2 }}
                  >
                    {loading ? 'Processing...' : 'Mark as Legacy'}
                  </Button>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* TAB 6: ACTIVITY LOG */}
          {currentTab === 6 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                📜 Activity Log
              </Typography>
              
              {activityLog.length === 0 ? (
                <Alert severity="info">
                  <AlertTitle>No Activity Yet</AlertTitle>
                  Actions you take will be logged here.
                </Alert>
              ) : (
                <List>
                  {activityLog.map((entry, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemText
                          primary={entry.message}
                          secondary={new Date(entry.timestamp).toLocaleString()}
                        />
                        <IconButton size="small">
                          <UndoIcon />
                        </IconButton>
                      </ListItem>
                      {index < activityLog.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          )}
        </Paper>
      </Container>

      {/* Skip Dialog */}
      <Dialog open={skipDialog.open} onClose={() => setSkipDialog({ open: false, issue: null })}>
        <DialogTitle>Skip with Note</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Why are you skipping this issue?
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
            placeholder="Explain why this issue can be skipped..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkipDialog({ open: false, issue: null })}>
            Cancel
          </Button>
          <Button onClick={handleSkipWithNote} variant="contained">
            Skip with Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}