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
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon
} from '@mui/icons-material';
import { db, auth } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  getDoc 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser
} from 'firebase/auth';
import Swal from 'sweetalert2';

const EmployeeAccountManager = ({ currentUser, currentUserRole }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'crew',
    phoneNumber: '',
    hourlyRate: ''
  });

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

  useEffect(() => {
    loadEmployees();
  }, []);

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
        password: '', // Don't pre-fill password for security
        role: employee.role || 'crew',
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

      if (formData.password.length < 6) {
        Swal.fire('Error', 'Password must be at least 6 characters long', 'error');
        return;
      }

      setLoading(true);

      // Step 1: Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      const newUserId = userCredential.user.uid;

      // Step 2: Create Firestore user document with role
      await setDoc(doc(db, 'users', newUserId), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phoneNumber: formData.phoneNumber || '',
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 0,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        active: true
      });

      Swal.fire({
        icon: 'success',
        title: 'Employee Created!',
        html: `
          <p><strong>${formData.name}</strong> has been created successfully!</p>
          <p><strong>Email:</strong> ${formData.email}</p>
          <p><strong>Role:</strong> ${formData.role}</p>
          <p><strong>Temporary Password:</strong> ${formData.password}</p>
          <p style="color: orange;">⚠️ Please share this password with the employee. They should change it after their first login.</p>
        `,
        confirmButtonText: 'Got it!'
      });

      handleCloseDialog();
      loadEmployees();

    } catch (error) {
      console.error('Error creating employee:', error);
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      }
      
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    try {
      if (!formData.name || !formData.email) {
        Swal.fire('Error', 'Please fill in Name and Email', 'error');
        return;
      }

      setLoading(true);

      // Update Firestore user document
      await updateDoc(doc(db, 'users', selectedEmployee.id), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phoneNumber: formData.phoneNumber || '',
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 0,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
      });

      // If password was provided, update it (Note: This requires the user to be signed in)
      // For security, password updates should be done by the user themselves
      if (formData.password && formData.password.length >= 6) {
        Swal.fire({
          icon: 'info',
          title: 'Password Update',
          text: 'For security reasons, please ask the employee to reset their password themselves through the "Forgot Password" feature.',
          confirmButtonText: 'OK'
        });
      }

      Swal.fire('Success', 'Employee updated successfully!', 'success');
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
    try {
      const result = await Swal.fire({
        title: `${employee.active ? 'Disable' : 'Enable'} Employee?`,
        text: `This will ${employee.active ? 'disable' : 'enable'} ${employee.name}'s account.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: employee.active ? '#d33' : '#3085d6',
        cancelButtonColor: '#6c757d',
        confirmButtonText: `Yes, ${employee.active ? 'disable' : 'enable'} it!`
      });

      if (result.isConfirmed) {
        await updateDoc(doc(db, 'users', employee.id), {
          active: !employee.active,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid
        });

        Swal.fire(
          `${employee.active ? 'Disabled' : 'Enabled'}!`,
          `${employee.name}'s account has been ${employee.active ? 'disabled' : 'enabled'}.`,
          'success'
        );

        loadEmployees();
      }
    } catch (error) {
      console.error('Error toggling employee status:', error);
      Swal.fire('Error', 'Failed to update employee status: ' + error.message, 'error');
    }
  };

  const handleDeleteEmployee = async (employee) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Employee?',
        html: `
          <p>Are you sure you want to delete <strong>${employee.name}</strong>?</p>
          <p style="color: red;">⚠️ This action cannot be undone!</p>
          <p>This will:</p>
          <ul style="text-align: left;">
            <li>Remove their Firestore user document</li>
            <li>Note: Firebase Authentication account must be deleted manually in Firebase Console</li>
          </ul>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        // Delete Firestore document
        await deleteDoc(doc(db, 'users', employee.id));

        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          html: `
            <p>${employee.name} has been removed from the system.</p>
            <p style="color: orange;">⚠️ Remember to also delete their Firebase Authentication account in Firebase Console if needed.</p>
          `
        });

        loadEmployees();
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      Swal.fire('Error', 'Failed to delete employee: ' + error.message, 'error');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'god':
        return 'error';
      case 'admin':
        return 'warning';
      case 'crew':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'god':
        return 'Owner (God)';
      case 'admin':
        return 'Manager (Admin)';
      case 'crew':
        return 'Worker (Crew)';
      default:
        return role;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                👥 Employee Account Manager
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage employee login accounts and roles
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenDialog()}
              size="large"
            >
              Add Employee
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🎭 Role Permissions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Chip label="👑 God (Owner)" color="error" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Full access to everything including financial data
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Chip label="⚙️ Admin (Manager)" color="warning" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Can manage most things except financial/sensitive data
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Chip label="👷 Crew (Worker)" color="info" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Can ONLY access Time Clock and Notes
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Employees Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Hourly Rate</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No employees yet. Click "Add Employee" to create the first one!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>{employee.name || 'N/A'}</TableCell>
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
                disabled={editMode} // Can't change email in edit mode
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
                    ? 'Leave blank to keep current password. For security, ask employee to reset password themselves.' 
                    : 'Minimum 6 characters. Employee should change this after first login.'
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
                  <MenuItem value="crew">👷 Crew (Worker) - Time Clock & Notes only</MenuItem>
                  <MenuItem value="admin">⚙️ Admin (Manager) - Most features except financials</MenuItem>
                  <MenuItem value="god">👑 God (Owner) - Full access to everything</MenuItem>
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
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {editMode ? 'Update Employee' : 'Create Employee'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EmployeeAccountManager;
