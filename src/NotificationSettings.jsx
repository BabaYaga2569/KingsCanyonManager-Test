import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import Swal from 'sweetalert2';
import SendIcon from '@mui/icons-material/Send';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { sendTestNotification } from './pushoverNotificationService';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    clockAlerts: {
      enabled: false,
      trackAllEmployees: true,
      trackedEmployeeIds: [],
    },
    paymentReminders: {
      enabled: false,
      daysBefore: 3,
    },
    jobReminders: {
      enabled: false,
      daysBefore: 1,
    },
    contractAlerts: {
      enabled: false,
    },
    bidAlerts: {
      enabled: false,
    },
    invoicePaidAlerts: {
      enabled: false,
    },
  });

  const [settingsId, setSettingsId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadSettings();
    loadEmployees();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDocs(collection(db, 'notification_settings'));
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        setSettingsId(docSnap.id);
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      Swal.fire({ title: 'Saved!', text: 'Notification settings updated', icon: 'success', timer: 2000 });
    } catch (error) {
      Swal.fire('Error', 'Failed to save: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    Swal.fire({ title: 'Sending...', text: 'Check your phone!', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const result = await sendTestNotification();
    setTesting(false);
    if (result.success) {
      Swal.fire({ title: '✅ Notification Sent!', text: 'Check your Pushover app on your phone', icon: 'success' });
    } else {
      Swal.fire({ title: 'Failed', text: result.error || 'Unknown error', icon: 'error' });
    }
  };

  const handleViewHistory = async () => {
    setLoadingHistory(true);
    setHistoryDialog(true);
    try {
      const snap = await getDocs(collection(db, 'notification_log'));
      const history = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        .slice(0, 50);
      setNotificationHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const updateSetting = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <NotificationsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Push Notification Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Instant alerts to your phone via Pushover
          </Typography>
        </Box>
      </Box>

      {/* Pushover Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
          <Box>
            <Typography variant="h6">Pushover Connected ✅</Typography>
            <Typography variant="body2" color="text.secondary">
              Notifications will be sent to your iPhone via the Pushover app
            </Typography>
          </Box>
        </Box>
        <Alert severity="success">
          No phone numbers needed — Pushover delivers directly to your device. No carrier issues, no 10DLC registration required.
        </Alert>
      </Paper>

      {/* Clock In/Out Alerts */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">👷 Crew Clock Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get notified when crew clocks in or out
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.clockAlerts.enabled}
                onChange={(e) => updateSetting('clockAlerts', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.clockAlerts.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        {settings.clockAlerts.enabled && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.clockAlerts.trackAllEmployees}
                  onChange={(e) => updateSetting('clockAlerts', 'trackAllEmployees', e.target.checked)}
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
                  onChange={(e) => updateSetting('clockAlerts', 'trackedEmployeeIds', e.target.value)}
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
          </>
        )}
      </Paper>

      {/* Contract Alerts */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">✍️ Contract Signed Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get notified instantly when a client signs a contract
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.contractAlerts.enabled}
                onChange={(e) => updateSetting('contractAlerts', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.contractAlerts.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
      </Paper>

      {/* Bid Alerts */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">📋 Bid Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get notified when a bid is viewed or accepted
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.bidAlerts.enabled}
                onChange={(e) => updateSetting('bidAlerts', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.bidAlerts.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
      </Paper>

      {/* Invoice Paid Alerts */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">💰 Payment Received Alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Get notified when an invoice is marked as paid
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.invoicePaidAlerts.enabled}
                onChange={(e) => updateSetting('invoicePaidAlerts', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.invoicePaidAlerts.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
      </Paper>

      {/* Payment Due Reminders */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">⏰ Invoice Due Reminders</Typography>
            <Typography variant="caption" color="text.secondary">
              Get reminded before invoices are due
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.paymentReminders.enabled}
                onChange={(e) => updateSetting('paymentReminders', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.paymentReminders.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        {settings.paymentReminders.enabled && (
          <TextField
            label="Days Before Due Date"
            type="number"
            value={settings.paymentReminders.daysBefore}
            onChange={(e) => updateSetting('paymentReminders', 'daysBefore', parseInt(e.target.value))}
            inputProps={{ min: 1, max: 14 }}
            fullWidth
            helperText="Send reminder this many days before payment is due"
          />
        )}
      </Paper>

      {/* Job Reminders */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">📅 Upcoming Job Reminders</Typography>
            <Typography variant="caption" color="text.secondary">
              Get reminded before scheduled jobs
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.jobReminders.enabled}
                onChange={(e) => updateSetting('jobReminders', 'enabled', e.target.checked)}
                color="primary"
              />
            }
            label={settings.jobReminders.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        {settings.jobReminders.enabled && (
          <TextField
            label="Days Before Job"
            type="number"
            value={settings.jobReminders.daysBefore}
            onChange={(e) => updateSetting('jobReminders', 'daysBefore', parseInt(e.target.value))}
            inputProps={{ min: 1, max: 7 }}
            fullWidth
            helperText="Send reminder this many days before the scheduled job"
          />
        )}
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSave}
          disabled={saving}
          sx={{ flex: 1, minWidth: 200, backgroundColor: '#2E7D32' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<SendIcon />}
          onClick={handleTestNotification}
          disabled={testing}
        >
          {testing ? 'Sending...' : 'Send Test Notification'}
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

      {/* Notification History Dialog */}
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Notification History (Last 50)</DialogTitle>
        <DialogContent>
          {loadingHistory ? (
            <Typography sx={{ p: 2 }}>Loading...</Typography>
          ) : (
            <List>
              {notificationHistory.map((notif) => (
                <ListItem key={notif.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={notif.type || 'notification'}
                          size="small"
                          color={notif.status === 'sent' ? 'success' : 'error'}
                        />
                        <Typography variant="body2">{notif.title}</Typography>
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary" component="span" display="block">
                          {notif.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span" display="block">
                          {notif.sentAt ? new Date(notif.sentAt).toLocaleString() : ''}
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