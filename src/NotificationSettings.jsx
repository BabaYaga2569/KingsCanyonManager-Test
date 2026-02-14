import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import Swal from 'sweetalert2';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import PhoneIcon from '@mui/icons-material/Phone';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { sendTestNotification, getNotificationHistory } from './smsNotificationService';

const CARRIERS = [
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'att', label: 'AT&T' },
  { value: 'verizon', label: 'Verizon' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'mint', label: 'Mint Mobile' },
  { value: 'metro', label: 'Metro by T-Mobile' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'visible', label: 'Visible' },
];

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    paymentReminders: {
      enabled: false,
      daysBefore: 3,
    },
    jobReminders: {
      enabled: false,
      daysBefore: 1,
    },
    clockAlerts: {
      enabled: false,
      trackAllEmployees: true,
      trackedEmployeeIds: [],
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00'
    },
    adminPhones: [],
    gmailEmail: 'ramslife2569@gmail.com',
    gmailAppPassword: '',
    gmailConfigured: false,
  });

  const [settingsId, setSettingsId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', carrier: 'tmobile' });
  const [historyDialog, setHistoryDialog] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSettings();
    loadEmployees();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDocs(collection(db, 'notification_settings'));
      if (!snap.empty) {
        const docData = snap.docs[0];
        setSettingsId(docData.id);
        const data = docData.data();
        setSettings(prev => ({
          ...prev,
          ...data,
          // Ensure nested objects exist
          clockAlerts: { ...prev.clockAlerts, ...(data.clockAlerts || {}) },
          paymentReminders: { ...prev.paymentReminders, ...(data.paymentReminders || {}) },
          jobReminders: { ...prev.jobReminders, ...(data.jobReminders || {}) },
          adminPhones: data.adminPhones || [],
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build save data
      const saveData = {
        ...settings,
        gmailConfigured: !!(settings.gmailEmail && settings.gmailAppPassword),
        updatedAt: new Date().toISOString(),
      };

      if (settingsId) {
        await updateDoc(doc(db, 'notification_settings', settingsId), saveData);
      } else {
        const docRef = await addDoc(collection(db, 'notification_settings'), saveData);
        setSettingsId(docRef.id);
      }

      // Update local state with gmailConfigured
      setSettings(prev => ({
        ...prev,
        gmailConfigured: !!(prev.gmailEmail && prev.gmailAppPassword),
      }));
      
      Swal.fire({
        title: 'Saved!',
        text: 'Notification settings updated',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      Swal.fire('Error', 'Failed to save: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = () => {
    if (!newAdmin.name || !newAdmin.phone) {
      Swal.fire('Error', 'Name and phone number are required', 'error');
      return;
    }

    // Clean phone number - digits only
    const cleanPhone = newAdmin.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Swal.fire('Error', 'Please enter a valid 10-digit phone number', 'error');
      return;
    }

    const adminEntry = {
      name: newAdmin.name.trim(),
      phone: cleanPhone.slice(-10), // Last 10 digits
      carrier: newAdmin.carrier || 'tmobile',
    };

    setSettings(prev => ({
      ...prev,
      adminPhones: [...(prev.adminPhones || []), adminEntry],
    }));

    setNewAdmin({ name: '', phone: '', carrier: 'tmobile' });
    setAddAdminDialog(false);
  };

  const handleRemoveAdmin = (index) => {
    setSettings(prev => ({
      ...prev,
      adminPhones: prev.adminPhones.filter((_, i) => i !== index),
    }));
  };

  const handleTestNotification = async () => {
    if (!settings.gmailConfigured && !(settings.gmailEmail && settings.gmailAppPassword)) {
      Swal.fire('Error', 'Please configure Gmail settings and save first', 'error');
      return;
    }

    if (!settings.adminPhones?.length) {
      Swal.fire('Error', 'Please add at least one admin phone number', 'error');
      return;
    }

    // Save first to make sure settings are current
    await handleSave();

    Swal.fire({
      title: 'Sending Test...',
      text: 'Please wait',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const result = await sendTestNotification();
    
    if (result.success) {
      Swal.fire({
        title: 'Test Sent!',
        text: 'Check your phone — you should receive a text within 10 seconds',
        icon: 'success',
      });
    } else {
      Swal.fire({
        title: 'Failed to Send',
        html: `<p>${result.error || 'Unknown error'}</p><p style="font-size:0.85em;color:#666;">Make sure your Gmail App Password is correct and you've saved settings.</p>`,
        icon: 'error',
      });
    }
  };

  const handleViewHistory = async () => {
    setLoading(true);
    setHistoryDialog(true);
    const history = await getNotificationHistory(50);
    setNotificationHistory(history);
    setLoading(false);
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const getCarrierLabel = (value) => {
    const carrier = CARRIERS.find(c => c.value === value);
    return carrier ? carrier.label : value;
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <NotificationsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">SMS Notification Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Get text alerts when employees clock in/out, invoices are due, and jobs are scheduled
          </Typography>
        </Box>
      </Box>

      {/* ===== GMAIL SETUP ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <EmailIcon color="primary" />
          <Typography variant="h6">Email-to-SMS Setup</Typography>
        </Box>

        <Alert severity={settings.gmailConfigured ? 'success' : 'info'} sx={{ mb: 2 }}>
          {settings.gmailConfigured
            ? '✅ Gmail is configured and ready to send notifications'
            : 'Set up Gmail to send text notifications to your phone for FREE — no Twilio needed!'}
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Gmail Address"
            value={settings.gmailEmail}
            onChange={(e) => setSettings({ ...settings, gmailEmail: e.target.value })}
            fullWidth
            helperText="The Gmail account that will send notifications"
          />
          <TextField
            label="Gmail App Password"
            value={settings.gmailAppPassword}
            onChange={(e) => setSettings({ ...settings, gmailAppPassword: e.target.value })}
            fullWidth
            type={showPassword ? 'text' : 'password'}
            placeholder="xxxx xxxx xxxx xxxx"
            helperText="16-character App Password (NOT your regular Gmail password)"
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              ),
            }}
          />
        </Box>

        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom fontWeight="bold">
            How to get a Gmail App Password:
          </Typography>
          <Typography variant="body2" component="div">
            1. Go to <strong>myaccount.google.com</strong> → Security → 2-Step Verification (enable it if off)<br/>
            2. At the bottom, click <strong>"App passwords"</strong><br/>
            3. Select app: <strong>Mail</strong>, Select device: <strong>Other</strong> → type "KCL Manager"<br/>
            4. Click <strong>Generate</strong> → copy the 16-character password and paste it above<br/>
            5. Click <strong>Save Settings</strong> below
          </Typography>
        </Alert>
      </Paper>

      {/* ===== ADMIN PHONES ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">📱 Admin Phones</Typography>
            <Typography variant="caption" color="text.secondary">
              These people receive ALL enabled notifications as text messages
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddAdminDialog(true)}
          >
            Add Admin
          </Button>
        </Box>

        {settings.adminPhones?.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No admin phones added yet. Add at least one phone number to receive notifications.
          </Alert>
        )}

        <List>
          {(settings.adminPhones || []).map((admin, index) => (
            <ListItem
              key={index}
              sx={{
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <PhoneIcon sx={{ mr: 2, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Typography fontWeight="bold">{admin.name}</Typography>
                }
                secondary={`${formatPhoneDisplay(admin.phone)} • ${getCarrierLabel(admin.carrier)}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={() => handleRemoveAdmin(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* ===== CLOCK IN/OUT ALERTS ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">⏰ Clock In/Out Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get texted when employees clock in and out
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.clockAlerts.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  clockAlerts: { ...settings.clockAlerts, enabled: e.target.checked }
                })}
                color="primary"
              />
            }
            label={settings.clockAlerts.enabled ? 'ON' : 'OFF'}
          />
        </Box>

        {settings.clockAlerts.enabled && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              When an employee clocks in or out, all admins above will receive a text like:<br/>
              <strong>"CLOCK IN — Mike Johnson - 8:30 AM — Job: John Smith"</strong>
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.clockAlerts.trackAllEmployees}
                  onChange={(e) => setSettings({
                    ...settings,
                    clockAlerts: { ...settings.clockAlerts, trackAllEmployees: e.target.checked }
                  })}
                />
              }
              label="Track all employees"
              sx={{ mb: 2 }}
            />

            {!settings.clockAlerts.trackAllEmployees && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Employees to Track</InputLabel>
                <Select
                  multiple
                  value={settings.clockAlerts.trackedEmployeeIds}
                  onChange={(e) => setSettings({
                    ...settings,
                    clockAlerts: { ...settings.clockAlerts, trackedEmployeeIds: e.target.value }
                  })}
                  renderValue={(selected) =>
                    selected.map(id => employees.find(e => e.id === id)?.name).join(', ')
                  }
                >
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quiet Hours Start"
                type="time"
                value={settings.clockAlerts.quietHoursStart}
                onChange={(e) => setSettings({
                  ...settings,
                  clockAlerts: { ...settings.clockAlerts, quietHoursStart: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
                helperText="No texts after this time"
              />
              <TextField
                label="Quiet Hours End"
                type="time"
                value={settings.clockAlerts.quietHoursEnd}
                onChange={(e) => setSettings({
                  ...settings,
                  clockAlerts: { ...settings.clockAlerts, quietHoursEnd: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
                helperText="Resume texts after this time"
              />
            </Box>
          </>
        )}
      </Paper>

      {/* ===== INVOICE / PAYMENT REMINDERS ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">💰 Invoice & Payment Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get texted about upcoming and overdue invoices
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.paymentReminders.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  paymentReminders: { ...settings.paymentReminders, enabled: e.target.checked }
                })}
                color="primary"
              />
            }
            label={settings.paymentReminders.enabled ? 'ON' : 'OFF'}
          />
        </Box>

        {settings.paymentReminders.enabled && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              You'll get a text when invoices are coming due and when they're overdue.
              Runs automatically every morning at 8 AM.
            </Alert>

            <TextField
              label="Days Before Due Date"
              type="number"
              value={settings.paymentReminders.daysBefore}
              onChange={(e) => setSettings({
                ...settings,
                paymentReminders: { ...settings.paymentReminders, daysBefore: parseInt(e.target.value) || 3 }
              })}
              inputProps={{ min: 1, max: 14 }}
              fullWidth
              helperText="Remind this many days before payment is due"
            />
          </>
        )}
      </Paper>

      {/* ===== JOB REMINDERS ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">📅 Upcoming Job Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get texted about scheduled jobs coming up
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.jobReminders.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  jobReminders: { ...settings.jobReminders, enabled: e.target.checked }
                })}
                color="primary"
              />
            }
            label={settings.jobReminders.enabled ? 'ON' : 'OFF'}
          />
        </Box>

        {settings.jobReminders.enabled && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Morning alert at 8 AM and evening summary at 6 PM for tomorrow's jobs.
            </Alert>

            <TextField
              label="Days Before Job"
              type="number"
              value={settings.jobReminders.daysBefore}
              onChange={(e) => setSettings({
                ...settings,
                jobReminders: { ...settings.jobReminders, daysBefore: parseInt(e.target.value) || 1 }
              })}
              inputProps={{ min: 1, max: 7 }}
              fullWidth
              helperText="Remind this many days before scheduled job"
            />
          </>
        )}
      </Paper>

      {/* ===== ACTION BUTTONS ===== */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSave}
          disabled={saving}
          sx={{ flex: 1, minWidth: 200 }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<SendIcon />}
          onClick={handleTestNotification}
        >
          Send Test Text
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<HistoryIcon />}
          onClick={handleViewHistory}
        >
          View History
        </Button>
      </Box>

      {/* ===== ADD ADMIN DIALOG ===== */}
      <Dialog
        open={addAdminDialog}
        onClose={() => setAddAdminDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Admin Phone</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              autoFocus
              label="Name"
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              fullWidth
              placeholder="Steve"
            />
            <TextField
              label="Phone Number"
              value={newAdmin.phone}
              onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
              fullWidth
              placeholder="928-450-5733"
              helperText="10-digit US phone number"
            />
            <FormControl fullWidth>
              <InputLabel>Carrier</InputLabel>
              <Select
                value={newAdmin.carrier}
                label="Carrier"
                onChange={(e) => setNewAdmin({ ...newAdmin, carrier: e.target.value })}
              >
                {CARRIERS.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAdminDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddAdmin}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* ===== NOTIFICATION HISTORY DIALOG ===== */}
      <Dialog
        open={historyDialog}
        onClose={() => setHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Notification History (Last 50)</DialogTitle>
        <DialogContent>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : (
            <List>
              {notificationHistory.map((notif) => (
                <ListItem key={notif.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={notif.type}
                          size="small"
                          color={notif.status === 'sent' ? 'success' : 'error'}
                        />
                        <Typography variant="body2">
                          {notif.toName || notif.to || 'Unknown'}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary" component="span" display="block">
                          {notif.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span" display="block">
                          {new Date(notif.sentAt).toLocaleString()}
                          {notif.error && ` — Error: ${notif.error}`}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
              {notificationHistory.length === 0 && (
                <Typography sx={{ p: 2, textAlign: 'center' }} color="text.secondary">
                  No notifications sent yet
                </Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}