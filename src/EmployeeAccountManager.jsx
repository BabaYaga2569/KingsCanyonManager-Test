import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  ButtonGroup, // ✅ NEW: For filter buttons
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { db, auth } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  getDoc,
  query, // ✅ NEW: For querying orphaned data
  where // ✅ NEW: For filtering by email
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser,
  signInWithEmailAndPassword
} from 'firebase/auth';
import Swal from 'sweetalert2';
import generateEmployeeNDAPDF from './pdf/generateEmployeeNDAPDF';

const EmployeeAccountManager = ({ currentUser, currentUserRole }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // NDA Viewer State
  const [ndaViewerOpen, setNdaViewerOpen] = useState(false);
  const [viewingNDA, setViewingNDA] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  // Logo for PDF
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  
  // ✅ NEW: Filter state
  const [filter, setFilter] = useState('active'); // Show active by default
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'crew',
    jobTitle: 'Crew Member',
    phoneNumber: '',
    hourlyRate: ''
  });

  useEffect(() => {
    if (currentUserRole === 'god') {
      loadEmployees();
    }
  }, [currentUserRole]);

  // Load logo for PDF generation
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Logo loading failed:', e);
        setLogoDataUrl(null);
      }
    };
    img.src = '/logo-kcl.png';
  }, []);

  // Only allow 'god' role to access this page
  if (currentUserRole !== 'god') {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          Access Denied: Only administrators can manage employee accounts.
        </Alert>
      </Container>
    );
  }

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const employeeList = [];
      snapshot.forEach((doc) => {
        employeeList.push({ id: doc.id, ...doc.data() });
      });
      
      setEmployees(employeeList);
    } catch (error) {
      console.error('Error loading employees:', error);
      Swal.fire('Error', 'Failed to load employees: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditMode(true);
      setSelectedEmployee(employee);
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        password: '',
        role: employee.role || 'crew',
        jobTitle: employee.jobTitle || 'Crew Member',
        phoneNumber: employee.phoneNumber || '',
        hourlyRate: employee.hourlyRate || ''
      });
    } else {
      setEditMode(false);
      setSelectedEmployee(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'crew',
        jobTitle: 'Crew Member',
        phoneNumber: '',
        hourlyRate: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditMode(false);
    setSelectedEmployee(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'crew',
      jobTitle: 'Crew Member',
      phoneNumber: '',
      hourlyRate: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateEmployee = async () => {
    try {
      // Validation
      if (!formData.name || !formData.email || !formData.password) {
        Swal.fire('Error', 'Please fill in all required fields: Name, Email, and Password', 'error');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        Swal.fire('Error', 'Please enter a valid email address (e.g., user@example.com)', 'error');
        return;
      }

      if (formData.password.length < 6) {
        Swal.fire('Error', 'Password must be at least 6 characters long', 'error');
        return;
      }

      // CRITICAL FIX: Save form data and close dialog FIRST
      const employeeData = { 
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        jobTitle: formData.jobTitle,
        phoneNumber: formData.phoneNumber.trim(),
        hourlyRate: formData.hourlyRate
      };
      const currentUserEmail = currentUser.email;
      
      console.log('Creating employee with data:', { ...employeeData, password: '***' });
      
      handleCloseDialog();

      // Prompt for YOUR password with high z-index
      const { value: currentPassword } = await Swal.fire({
        title: 'Confirm Your Password',
        text: 'To create an employee account, please enter YOUR password:',
        input: 'password',
        inputPlaceholder: 'Your password',
        showCancelButton: true,
        allowOutsideClick: false,
        customClass: {
          container: 'swal-high-zindex'
        },
        inputValidator: (value) => {
          if (!value) {
            return 'You need to enter your password!'
          }
        }
      });

      if (!currentPassword) {
        // User cancelled - reopen dialog with saved data
        setFormData(employeeData);
        setOpenDialog(true);
        return;
      }

      // Show loading
      Swal.fire({
        title: 'Creating Employee...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      console.log('Step 1: Creating Firebase Auth account for:', employeeData.email);

      // Step 1: Create Firebase Authentication account (this logs us in as the new user)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        employeeData.email,
        employeeData.password
      );
      
      const newUserId = userCredential.user.uid;
      console.log('Step 2: Auth account created with UID:', newUserId);

      // CRITICAL FIX: Re-login as god IMMEDIATELY before creating Firestore doc
      console.log('Step 3: Re-logging in as god:', currentUserEmail);
      await signInWithEmailAndPassword(auth, currentUserEmail, currentPassword);
      console.log('Step 4: Successfully re-logged in as god');

      // Wait a moment for auth state to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: NOW create Firestore user document (while logged in as god)
      console.log('Step 5: Creating Firestore document for new employee');
      await setDoc(doc(db, 'users', newUserId), {
        name: employeeData.name,
        email: employeeData.email,
        role: employeeData.role,
        jobTitle: employeeData.jobTitle,
        phoneNumber: employeeData.phoneNumber || '',
        hourlyRate: employeeData.hourlyRate ? parseFloat(employeeData.hourlyRate) : 0,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        active: true,
        firstLogin: true,
        ndaSigned: false,
        ndaSignedDate: null,
        ndaSignatureUrl: null,
        startDate: new Date().toISOString()
      });
      console.log('Step 6: Firestore document created successfully');

      // Wait for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      Swal.fire({
        icon: 'success',
        title: 'Employee Created!',
        html: `
          <p><strong>${employeeData.name}</strong> has been created successfully!</p>
          <p><strong>Job Title:</strong> ${employeeData.jobTitle}</p>
          <p><strong>Email:</strong> ${employeeData.email}</p>
          <p><strong>Role:</strong> ${employeeData.role}</p>
          <p><strong>Temporary Password:</strong> ${employeeData.password}</p>
          <p style="color: orange;">⚠️ Share this password with the employee.</p>
          <p style="color: blue;">📝 They will sign the NDA on first login.</p>
        `,
        confirmButtonText: 'Got it!'
      });

      loadEmployees();

    } catch (error) {
      console.error('Error creating employee:', error);
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password too weak.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Try again.';
      }
      
      Swal.fire('Error', errorMessage, 'error');
    }
  };

  const handleUpdateEmployee = async () => {
    try {
      if (!selectedEmployee) return;

      setLoading(true);

      const updates = {
        name: formData.name,
        role: formData.role,
        jobTitle: formData.jobTitle,
        phoneNumber: formData.phoneNumber || '',
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 0,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
      };

      const userRef = doc(db, 'users', selectedEmployee.id);
      await updateDoc(userRef, updates);

      await Swal.fire({
        icon: 'success',
        title: 'Employee Updated!',
        text: `${formData.name}'s information updated successfully.`,
      });

      handleCloseDialog();
      loadEmployees();

    } catch (error) {
      console.error('Error updating employee:', error);
      Swal.fire('Error', 'Failed to update employee: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (employee) => {
    const newActiveStatus = !employee.active;
    
    const result = await Swal.fire({
      title: newActiveStatus ? 'Enable Employee?' : 'Disable Employee?',
      html: `
        <p>${newActiveStatus ? 'Enable' : 'Disable'} <strong>${employee.name}</strong>?</p>
        <hr />
        <div style="text-align: left; margin: 15px 0;">
          ${newActiveStatus ? 
            '<p>✅ They will be able to clock in again</p><p>✅ They will appear in the time clock</p>' :
            '<p>❌ They will NOT be able to clock in</p><p>✅ Their records will be preserved</p>'
          }
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: newActiveStatus ? 'Enable' : 'Disable',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(db, 'users', employee.id), {
          active: newActiveStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid,
          ...(newActiveStatus ? {} : { inactivatedAt: new Date().toISOString() })
        });

        Swal.fire({
          icon: 'success',
          title: newActiveStatus ? 'Account Enabled!' : 'Account Disabled!',
          text: `${employee.name}'s account has been ${newActiveStatus ? 'enabled' : 'disabled'}.`,
          timer: 2000,
          showConfirmButton: false,
        });

        loadEmployees();
      } catch (error) {
        console.error('Error toggling account status:', error);
        Swal.fire('Error', 'Failed to update account status: ' + error.message, 'error');
      }
    }
  };

  const handleDeleteEmployee = async (employee) => {
    try {
      // ✅ IMPROVEMENT D: Check orphaned data first
      const timeEntriesSnap = await getDocs(
        query(collection(db, 'job_time_entries'), where('crewEmail', '==', employee.email))
      );
      const paymentsSnap = await getDocs(
        query(collection(db, 'crew_payments'), where('crewEmail', '==', employee.email))
      );

      const timeCount = timeEntriesSnap.size;
      const paymentCount = paymentsSnap.size;

      const result = await Swal.fire({
        title: 'Delete Employee?',
        html: `
          <p>Delete <strong>${employee.name}</strong>?</p>
          <hr />
          <div style="text-align: left; margin: 15px 0; background-color: #fff3cd; padding: 10px; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>⚠️ Warning:</strong></p>
            <p style="margin: 5px 0;">• <strong>${timeCount}</strong> time ${timeCount === 1 ? 'entry' : 'entries'} will be orphaned</p>
            <p style="margin: 5px 0;">• <strong>${paymentCount}</strong> payment ${paymentCount === 1 ? 'record' : 'records'} will be orphaned</p>
            <p style="margin: 5px 0;">• This cannot be undone!</p>
          </div>
          <hr />
          <div style="text-align: left; margin: 15px 0; background-color: #d1ecf1; padding: 10px; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>💡 Better option:</strong></p>
            <p style="margin: 5px 0;">Mark as <em>Inactive</em> instead?</p>
            <p style="margin: 5px 0;">• Preserves all records for taxes</p>
            <p style="margin: 5px 0;">• Prevents them from clocking in</p>
            <p style="margin: 5px 0;">• Can be reactivated later</p>
          </div>
        `,
        icon: 'warning',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '🗑️ Delete Anyway',
        denyButtonText: '🔒 Mark Inactive Instead',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d32f2f',
        denyButtonColor: '#1976d2',
        width: '600px',
      });

      if (result.isConfirmed) {
        // User chose to delete
        await deleteDoc(doc(db, 'users', employee.id));

        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          html: `
            <p>${employee.name} has been deleted.</p>
            <p style="color: orange;">⚠️ ${timeCount + paymentCount} records are now orphaned.</p>
            <p style="color: blue;">💡 Use the Orphaned Data Scanner to clean them up.</p>
          `,
          timer: 4000,
        });

        loadEmployees();
      } else if (result.isDenied) {
        // User chose to mark inactive instead
        await updateDoc(doc(db, 'users', employee.id), {
          active: false,
          inactivatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid,
        });

        Swal.fire({
          icon: 'success',
          title: 'Marked Inactive!',
          html: `
            <p><strong>${employee.name}</strong> can no longer clock in.</p>
            <p>✅ All records preserved for taxes</p>
            <p>✅ Can be reactivated anytime</p>
          `,
          timer: 3000,
        });

        loadEmployees();
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Error', 'Failed to process request: ' + error.message, 'error');
    }
  };

  const handleViewNDA = (employee) => {
    if (!employee.ndaSigned) {
      Swal.fire('Info', 'This employee has not signed the NDA yet.', 'info');
      return;
    }
    setViewingNDA(employee);
    setNdaViewerOpen(true);
  };

  const handleCloseNDAViewer = () => {
    setNdaViewerOpen(false);
    setViewingNDA(null);
  };

  const handleDownloadNDAPDF = async () => {
    if (!viewingNDA) return;

    try {
      setGeneratingPDF(true);

      // Generate PDF
      const pdf = await generateEmployeeNDAPDF(viewingNDA, logoDataUrl);

      // Download PDF
      const fileName = `NDA_${viewingNDA.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      await Swal.fire({
        icon: 'success',
        title: 'PDF Downloaded!',
        text: `Saved as ${fileName}`,
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to generate PDF. Please try again.'
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleViewSignature = () => {
    if (viewingNDA && viewingNDA.ndaSignatureUrl) {
      window.open(viewingNDA.ndaSignatureUrl, '_blank');
    }
  };

  // ✅ NEW: Filter employees by status
  const filteredEmployees = employees.filter(emp => {
    if (filter === 'active') return emp.active !== false;
    if (filter === 'inactive') return emp.active === false;
    return true; // 'all'
  });

  const getRoleLabel = (role) => {
    switch(role) {
      case 'god': return 'Owner';
      case 'admin': return 'Admin';
      case 'crew': return 'Crew';
      default: return 'User';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'god': return 'error';
      case 'admin': return 'primary';
      case 'crew': return 'success';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                Employee Account Manager
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create and manage employee accounts, roles, and access permissions
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size="large"
            >
              Add Employee
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {employees.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active
              </Typography>
              <Typography variant="h4" color="success.main">
                {employees.filter(e => e.active !== false).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                NDA Signed
              </Typography>
              <Typography variant="h4" color="primary.main">
                {employees.filter(e => e.ndaSigned === true).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Pending NDA
              </Typography>
              <Typography variant="h4" color="warning.main">
                {employees.filter(e => e.ndaSigned === false || e.firstLogin === true).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ✅ NEW: Filter Buttons */}
      <Box sx={{ mb: 2 }}>
        <ButtonGroup variant="contained" size="large">
          <Button 
            color={filter === 'all' ? 'primary' : 'inherit'}
            onClick={() => setFilter('all')}
          >
            All ({employees.length})
          </Button>
          <Button 
            color={filter === 'active' ? 'success' : 'inherit'}
            onClick={() => setFilter('active')}
          >
            Active ({employees.filter(e => e.active !== false).length})
          </Button>
          <Button 
            color={filter === 'inactive' ? 'warning' : 'inherit'}
            onClick={() => setFilter('inactive')}
          >
            Inactive ({employees.filter(e => e.active === false).length})
          </Button>
        </ButtonGroup>
      </Box>

      {/* Employee Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress size={60} />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Job Title</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Hourly Rate</strong></TableCell>
                <TableCell><strong>NDA Status</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      {filter === 'active' && 'No active employees.'}
                      {filter === 'inactive' && 'No inactive employees.'}
                      {filter === 'all' && 'No employees yet. Click "Add Employee" to create the first one!'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>{employee.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={employee.jobTitle || 'N/A'} 
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{employee.email || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getRoleLabel(employee.role)} 
                        color={getRoleBadgeColor(employee.role)} 
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{employee.phoneNumber || 'N/A'}</TableCell>
                    <TableCell>
                      {employee.hourlyRate ? `$${employee.hourlyRate.toFixed(2)}/hr` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {employee.ndaSigned ? (
                        <Chip 
                          icon={<CheckCircleIcon />}
                          label="Signed" 
                          color="success" 
                          size="small"
                          onClick={() => handleViewNDA(employee)}
                          sx={{ cursor: 'pointer' }}
                        />
                      ) : (
                        <Chip 
                          icon={<PendingIcon />}
                          label="Pending" 
                          color="warning" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={employee.active !== false ? 'Active' : 'Disabled'} 
                        color={employee.active !== false ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenDialog(employee)}
                        title="Edit Employee"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color={employee.active !== false ? 'warning' : 'success'}
                        onClick={() => handleToggleActive(employee)}
                        title={employee.active !== false ? 'Disable Account' : 'Enable Account'}
                      >
                        {employee.active !== false ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                      </IconButton>
                      {employee.id !== currentUser.uid && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteEmployee(employee)}
                          title="Delete Employee"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Employee Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? '✏️ Edit Employee' : '➕ Add New Employee'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name *"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email *"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={editMode}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={editMode ? 'New Password (optional)' : 'Password *'}
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!editMode}
                helperText={
                  editMode 
                    ? 'Leave blank to keep current password.' 
                    : 'Minimum 6 characters.'
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role *</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  label="Role *"
                >
                  <MenuItem value="crew">👷 Crew - Time Clock only</MenuItem>
                  <MenuItem value="admin">⚙️ Admin - Most features</MenuItem>
                  <MenuItem value="god">👑 God - Full access</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Job Title *</InputLabel>
                <Select
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleInputChange}
                  label="Job Title *"
                >
                  <MenuItem value="Owner">👑 Owner</MenuItem>
                  <MenuItem value="Manager">⚙️ Manager</MenuItem>
                  <MenuItem value="Foreman">🔨 Foreman</MenuItem>
                  <MenuItem value="Crew Member">👷 Crew Member</MenuItem>
                  <MenuItem value="Equipment Operator">🚜 Equipment Operator</MenuItem>
                  <MenuItem value="Landscaper">🌳 Landscaper</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Hourly Rate"
                name="hourlyRate"
                type="number"
                value={formData.hourlyRate}
                onChange={handleInputChange}
                InputProps={{
                  startAdornment: <Typography>$</Typography>,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={editMode ? handleUpdateEmployee : handleCreateEmployee}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {editMode ? 'Update Employee' : 'Create Employee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* NDA Viewer Dialog */}
      <Dialog open={ndaViewerOpen} onClose={handleCloseNDAViewer} maxWidth="md" fullWidth>
        <DialogTitle>
          📋 NDA Signature - {viewingNDA?.name}
        </DialogTitle>
        <DialogContent>
          {viewingNDA && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  <strong>NDA Signed!</strong> This employee has completed and signed the Non-Disclosure Agreement.
                </Alert>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Employee Name
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {viewingNDA.name}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Email
                </Typography>
                <Typography variant="body1">
                  {viewingNDA.email}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Job Title
                </Typography>
                <Typography variant="body1">
                  {viewingNDA.jobTitle}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Date Signed
                </Typography>
                <Typography variant="body1">
                  {viewingNDA.ndaSignedDate 
                    ? new Date(viewingNDA.ndaSignedDate).toLocaleString()
                    : 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Digital Signature
                </Typography>
                <Paper 
                  elevation={2} 
                  sx={{ 
                    p: 2, 
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 200
                  }}
                >
                  {viewingNDA.ndaSignatureUrl ? (
                    <Box sx={{ textAlign: 'center' }}>
                      <img 
                        src={viewingNDA.ndaSignatureUrl} 
                        alt="Signature"
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '200px',
                          border: '2px solid #1976d2',
                          borderRadius: '4px',
                          backgroundColor: 'white'
                        }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleViewSignature}
                        sx={{ mt: 2 }}
                      >
                        View Full Size
                      </Button>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">
                      No signature image available
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Complete NDA Document:</strong> Download the full signed NDA as a PDF with all terms, conditions, and the employee's signature.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNDAViewer} color="inherit">
            Close
          </Button>
          <Button
            onClick={handleDownloadNDAPDF}
            variant="contained"
            color="primary"
            disabled={generatingPDF}
            startIcon={generatingPDF ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {generatingPDF ? 'Generating PDF...' : 'Download Full NDA PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EmployeeAccountManager;