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
import { sendTestNotification, getNotificationHistory } from './smsNotificationService';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    paymentReminders: {
      enabled: false,
      daysBefore: 3,
      phoneNumbers: []
    },
    jobReminders: {
      enabled: false,
      daysBefore: 1,
      phoneNumbers: []
    },
    clockAlerts: {
      enabled: false,
      trackAllEmployees: true,
      trackedEmployeeIds: [],
      phoneNumbers: [],
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00'
    },
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    twilioConfigured: false
  });

  const [settingsId, setSettingsId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [addPhoneDialog, setAddPhoneDialog] = useState({ open: false, type: null });
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [historyDialog, setHistoryDialog] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadEmployees();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDocs(collection(db, 'notification_settings'));
      if (!snap.empty) {
        const doc = snap.docs[0];
        setSettingsId(doc.id);
        setSettings({ ...settings, ...doc.data() });
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
      if (settingsId) {
        await updateDoc(doc(db, 'notification_settings', settingsId), settings);
      } else {
        const docRef = await addDoc(collection(db, 'notification_settings'), settings);
        setSettingsId(docRef.id);
      }
      
      Swal.fire({
        title: 'Saved!',
        text: 'Notification settings updated successfully',
        icon: 'success',
        timer: 2000
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      Swal.fire('Error', 'Failed to save settings: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoneNumber = (type) => {
    if (!newPhoneNumber || newPhoneNumber.trim() === '') {
      Swal.fire('Error', 'Please enter a phone number', 'error');
      return;
    }

    // Format phone number
    let formatted = newPhoneNumber.trim();
    if (!formatted.startsWith('+')) {
      formatted = '+1' + formatted.replace(/\D/g, '');
    }

    // Add to appropriate array
    const newSettings = { ...settings };
    if (type === 'payment') {
      newSettings.paymentReminders.phoneNumbers.push(formatted);
    } else if (type === 'job') {
      newSettings.jobReminders.phoneNumbers.push(formatted);
    } else if (type === 'clock') {
      newSettings.clockAlerts.phoneNumbers.push(formatted);
    }

    setSettings(newSettings);
    setNewPhoneNumber('');
    setAddPhoneDialog({ open: false, type: null });
  };

  const handleRemovePhoneNumber = (type, index) => {
    const newSettings = { ...settings };
    if (type === 'payment') {
      newSettings.paymentReminders.phoneNumbers.splice(index, 1);
    } else if (type === 'job') {
      newSettings.jobReminders.phoneNumbers.splice(index, 1);
    } else if (type === 'clock') {
      newSettings.clockAlerts.phoneNumbers.splice(index, 1);
    }
    setSettings(newSettings);
  };

  const handleTestNotification = async () => {
    // Gather all unique phone numbers from settings
    const allNumbers = [
      ...(settings.clockAlerts?.phoneNumbers || []),
      ...(settings.paymentReminders?.phoneNumbers || []),
      ...(settings.jobReminders?.phoneNumbers || []),
    ];
    const uniqueNumbers = [...new Set(allNumbers)];

    // Build dropdown options
    const inputOptions = {};
    uniqueNumbers.forEach(num => { inputOptions[num] = num; });
    inputOptions["custom"] = "-- Enter a different number --";

    let result;
    if (uniqueNumbers.length > 0) {
      result = await Swal.fire({
        title: "Send Test SMS",
        input: "select",
        inputOptions,
        inputLabel: "Select phone number to test",
        showCancelButton: true,
        confirmButtonText: "Send Test",
        inputValidator: (value) => {
          if (!value) return "Please select a phone number";
        }
      });

      // If they picked custom, prompt for manual entry
      if (result.isConfirmed && result.value === "custom") {
        result = await Swal.fire({
          title: "Send Test SMS",
          input: "text",
          inputLabel: "Enter phone number",
          inputPlaceholder: "+19285551234",
          showCancelButton: true,
          confirmButtonText: "Send Test",
          inputValidator: (value) => {
            if (!value) return "Please enter a phone number";
          }
        });
      }
    } else {
      result = await Swal.fire({
        title: "Send Test SMS",
        input: "text",
        inputLabel: "Enter phone number to test",
        inputPlaceholder: "+19285551234",
        showCancelButton: true,
        confirmButtonText: "Send Test",
        inputValidator: (value) => {
          if (!value) return "Please enter a phone number";
        }
      });
    }

    if (result.isConfirmed) {
      Swal.fire({
        title: 'Sending...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const testResult = await sendTestNotification(result.value);
      
      if (testResult.success) {
        Swal.fire({
          title: 'Test SMS Sent!',
          text: 'Check your phone for the test message',
          icon: 'success'
        });
      } else {
        Swal.fire({
          title: 'Failed to Send',
          text: testResult.error || 'Unknown error',
          icon: 'error'
        });
      }
    }
  };

  const handleViewHistory = async () => {
    setLoading(true);
    setHistoryDialog(true);
    const history = await getNotificationHistory(50);
    setNotificationHistory(history);
    setLoading(false);
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <NotificationsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">SMS Notification Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure automated text message notifications
          </Typography>
        </Box>
      </Box>

      {/* Twilio Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Twilio Configuration
        </Typography>
        <Alert severity={settings.twilioConfigured ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {settings.twilioConfigured
            ? '✅ Twilio is configured and ready to send SMS'
            : '⚠️ Configure Twilio credentials to enable SMS notifications'}
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Twilio Account SID"
            value={settings.twilioAccountSid}
            onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
            fullWidth
            type="password"
            helperText="Found in your Twilio console dashboard"
          />
          <TextField
            label="Twilio Auth Token"
            value={settings.twilioAuthToken}
            onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
            fullWidth
            type="password"
            helperText="Found in your Twilio console dashboard"
          />
          <TextField
            label="Twilio Phone Number"
            value={settings.twilioPhoneNumber}
            onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
            fullWidth
            placeholder="+19285551234"
            helperText="Your Twilio phone number (must include +1)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.twilioConfigured}
                onChange={(e) => setSettings({ ...settings, twilioConfigured: e.target.checked })}
              />
            }
            label="Twilio Configured (enable after adding credentials)"
          />
        </Box>
      </Paper>

      {/* Clock In/Out Alerts */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">👔 Admin Clock Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              YOU get notified when crew clocks in/out
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
            label={settings.clockAlerts.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>📱 You Get Notified:</strong> When employees clock in/out, YOU receive instant text messages.
            Perfect for tracking who is working in real-time!
          </Typography>
        </Alert>

        {settings.clockAlerts.enabled && (
          <>
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

            <Typography variant="subtitle2" gutterBottom>
              Admin Phone Numbers (YOU get notified):
            </Typography>
            <Box sx={{ mb: 2 }}>
              {settings.clockAlerts.phoneNumbers.map((phone, index) => (
                <Chip
                  key={index}
                  label={phone}
                  onDelete={() => handleRemovePhoneNumber('clock', index)}
                  icon={<PhoneIcon />}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddPhoneDialog({ open: true, type: 'clock' })}
              >
                Add Number
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Quiet Hours Start"
                type="time"
                value={settings.clockAlerts.quietHoursStart}
                onChange={(e) => setSettings({
                  ...settings,
                  clockAlerts: { ...settings.clockAlerts, quietHoursStart: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
                helperText="No notifications after this time"
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
                helperText="Resume notifications after this time"
              />
            </Box>
          </>
        )}
      </Paper>

      {/* Payment Reminders */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Payment Reminders</Typography>
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
            label={settings.paymentReminders.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Automatically remind customers about upcoming payments
        </Alert>

        {settings.paymentReminders.enabled && (
          <>
            <TextField
              label="Days Before Due Date"
              type="number"
              value={settings.paymentReminders.daysBefore}
              onChange={(e) => setSettings({
                ...settings,
                paymentReminders: { ...settings.paymentReminders, daysBefore: parseInt(e.target.value) }
              })}
              inputProps={{ min: 1, max: 14 }}
              fullWidth
              sx={{ mb: 2 }}
              helperText="Send reminder this many days before payment is due"
            />

            <Typography variant="subtitle2" gutterBottom>
              Send To (Optional - for internal tracking):
            </Typography>
            <Box sx={{ mb: 2 }}>
              {settings.paymentReminders.phoneNumbers.map((phone, index) => (
                <Chip
                  key={index}
                  label={phone}
                  onDelete={() => handleRemovePhoneNumber('payment', index)}
                  icon={<PhoneIcon />}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddPhoneDialog({ open: true, type: 'payment' })}
              >
                Add Number
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* Job Reminders */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Job Reminders</Typography>
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
            label={settings.jobReminders.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Automatically remind customers about upcoming scheduled jobs
        </Alert>

        {settings.jobReminders.enabled && (
          <>
            <TextField
              label="Days Before Job"
              type="number"
              value={settings.jobReminders.daysBefore}
              onChange={(e) => setSettings({
                ...settings,
                jobReminders: { ...settings.jobReminders, daysBefore: parseInt(e.target.value) }
              })}
              inputProps={{ min: 1, max: 7 }}
              fullWidth
              sx={{ mb: 2 }}
              helperText="Send reminder this many days before scheduled job"
            />

            <Typography variant="subtitle2" gutterBottom>
              Send To (Optional - for internal tracking):
            </Typography>
            <Box sx={{ mb: 2 }}>
              {settings.jobReminders.phoneNumbers.map((phone, index) => (
                <Chip
                  key={index}
                  label={phone}
                  onDelete={() => handleRemovePhoneNumber('job', index)}
                  icon={<PhoneIcon />}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddPhoneDialog({ open: true, type: 'job' })}
              >
                Add Number
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* Action Buttons */}
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
          disabled={!settings.twilioConfigured}
        >
          Send Test SMS
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

      {/* Add Phone Number Dialog */}
      <Dialog
        open={addPhoneDialog.open}
        onClose={() => setAddPhoneDialog({ open: false, type: null })}
      >
        <DialogTitle>Add Phone Number</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Phone Number"
            value={newPhoneNumber}
            onChange={(e) => setNewPhoneNumber(e.target.value)}
            fullWidth
            placeholder="+1 928-450-5733"
            helperText="Include country code (e.g., +1 for US)"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPhoneDialog({ open: false, type: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleAddPhoneNumber(addPhoneDialog.type)}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification History Dialog */}
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
                          {notif.to}
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