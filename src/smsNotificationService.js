// smsNotificationService.js
// SMS Notification Service using Twilio (Direct API)
// Sends ADMIN notifications when employees clock in/out

import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Send SMS notification via Twilio API (Direct)
 */
export async function sendSMS(to, message, type, metadata = {}) {
  try {
    console.log(`📱 Sending SMS to ${to}`);
    
    // Get Twilio credentials from settings
    const settings = await getNotificationSettings();
    
    if (!settings?.twilioConfigured) {
      throw new Error('Twilio not configured');
    }
    
    const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = settings;
    
    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    // Create form data
    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', twilioPhoneNumber);
    formData.append('Body', message);
    
    // Make request to Twilio
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Twilio error: ${errorData.message || response.statusText}`);
    }
    
    const result = await response.json();
    
    // Log success
    await logNotification({
      to,
      message,
      type,
      status: 'sent',
      sentAt: new Date().toISOString(),
      metadata,
      twilioSid: result.sid
    });
    
    console.log('✅ SMS sent:', result.sid);
    return { success: true, sid: result.sid };
    
  } catch (error) {
    console.error('❌ SMS error:', error);
    
    // Log failure
    await logNotification({
      to,
      message,
      type,
      status: 'failed',
      sentAt: new Date().toISOString(),
      metadata,
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Log notification to Firestore
 */
async function logNotification(data) {
  try {
    await addDoc(collection(db, 'notifications_log'), data);
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

/**
 * Get notification settings from Firestore
 */
export async function getNotificationSettings() {
  try {
    const snap = await getDocs(collection(db, 'notification_settings'));
    if (snap.empty) {
      return {
        paymentReminders: { enabled: false, daysBefore: 3, phoneNumbers: [] },
        jobReminders: { enabled: false, daysBefore: 1, phoneNumbers: [] },
        clockAlerts: {
          enabled: false,
          trackAllEmployees: true,
          trackedEmployeeIds: [],
          phoneNumbers: [],
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00'
        },
        twilioConfigured: false
      };
    }
    
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

/**
 * Send employee clock in notification to ADMINS
 */
export async function sendClockInNotification(employee, timestamp, job = null) {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings?.clockAlerts?.enabled) {
      console.log('⏸️ Clock alerts disabled');
      return { success: false, reason: 'disabled' };
    }
    
    if (!settings?.clockAlerts?.phoneNumbers?.length) {
      console.log('⚠️ No admin phone numbers');
      return { success: false, reason: 'no_recipients' };
    }
    
    // Check quiet hours
    if (isQuietHours(settings.clockAlerts)) {
      console.log('🔕 Quiet hours');
      return { success: false, reason: 'quiet_hours' };
    }
    
    // Check if tracking this employee
    if (!settings.clockAlerts.trackAllEmployees) {
      if (!settings.clockAlerts.trackedEmployeeIds?.includes(employee.id)) {
        console.log(`⏭️ Not tracking ${employee.name}`);
        return { success: false, reason: 'not_tracked' };
      }
    }
    
    const time = new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    let message = `⏰ CLOCK IN\n${employee.name} - ${time}`;
    
    if (job) {
      message += `\nJob: ${job.clientName || job.name || 'Unknown'}`;
    }
    
    // Send to all admins
    const results = [];
    for (const phoneNumber of settings.clockAlerts.phoneNumbers) {
      const result = await sendSMS(phoneNumber, message, 'clock_in', {
        employeeId: employee.id,
        employeeName: employee.name,
        timestamp,
        jobId: job?.id
      });
      results.push(result);
    }
    
    return { success: true, results };
    
  } catch (error) {
    console.error('❌ Clock in error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send employee clock out notification to ADMINS
 */
export async function sendClockOutNotification(employee, clockInTime, clockOutTime, job = null) {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings?.clockAlerts?.enabled) {
      console.log('⏸️ Clock alerts disabled');
      return { success: false, reason: 'disabled' };
    }
    
    if (!settings?.clockAlerts?.phoneNumbers?.length) {
      console.log('⚠️ No admin phone numbers');
      return { success: false, reason: 'no_recipients' };
    }
    
    // Check quiet hours
    if (isQuietHours(settings.clockAlerts)) {
      console.log('🔕 Quiet hours');
      return { success: false, reason: 'quiet_hours' };
    }
    
    // Check if tracking this employee
    if (!settings.clockAlerts.trackAllEmployees) {
      if (!settings.clockAlerts.trackedEmployeeIds?.includes(employee.id)) {
        console.log(`⏭️ Not tracking ${employee.name}`);
        return { success: false, reason: 'not_tracked' };
      }
    }
    
    const time = new Date(clockOutTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const duration = calculateDuration(clockInTime, clockOutTime);
    
    let message = `🏁 CLOCK OUT\n${employee.name} - ${time}\nDuration: ${duration}`;
    
    if (job) {
      message += `\nJob: ${job.clientName || job.name || 'Unknown'}`;
    }
    
    // Send to all admins
    const results = [];
    for (const phoneNumber of settings.clockAlerts.phoneNumbers) {
      const result = await sendSMS(phoneNumber, message, 'clock_out', {
        employeeId: employee.id,
        employeeName: employee.name,
        clockInTime,
        clockOutTime,
        duration,
        jobId: job?.id
      });
      results.push(result);
    }
    
    return { success: true, results };
    
  } catch (error) {
    console.error('❌ Clock out error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if in quiet hours
 */
function isQuietHours(clockAlertSettings) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const [startHour, startMinute] = clockAlertSettings.quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = clockAlertSettings.quietHoursEnd.split(':').map(Number);
  
  const quietStart = startHour * 60 + startMinute;
  const quietEnd = endHour * 60 + endMinute;
  
  // Handle quiet hours that span midnight
  if (quietStart > quietEnd) {
    return currentTime >= quietStart || currentTime < quietEnd;
  } else {
    return currentTime >= quietStart && currentTime < quietEnd;
  }
}

/**
 * Calculate duration between timestamps
 */
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Get notification history
 */
export async function getNotificationHistory(limit_count = 50) {
  try {
    const q = query(
      collection(db, 'notifications_log'),
      orderBy('sentAt', 'desc'),
      limit(limit_count)
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting history:', error);
    return [];
  }
}

/**
 * Test SMS notification
 */
export async function sendTestNotification(phoneNumber) {
  const message = `✅ TEST\n\nKCL Manager test notification working!\n\n${new Date().toLocaleString()}`;
  
  return await sendSMS(phoneNumber, message, 'test', { test: true });
}