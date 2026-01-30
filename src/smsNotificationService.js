// smsNotificationService.js
// SMS Notification Service using Twilio

import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Send SMS notification via backend API
 * @param {string} to - Phone number to send to (e.g., "+19284505733")
 * @param {string} message - SMS message content
 * @param {string} type - Notification type: 'clock_in', 'clock_out', 'payment_reminder', 'job_reminder'
 * @param {Object} metadata - Additional data to log with notification
 */
export async function sendSMS(to, message, type, metadata = {}) {
  try {
    console.log(`📱 Sending SMS to ${to}: ${message}`);
    
    // Call your Firebase Cloud Function (we'll create this next)
    const response = await fetch('https://us-central1-landscape-manager-8dad0.cloudfunctions.net/sendSMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        message,
        type,
        metadata
      })
    });
    
    if (!response.ok) {
      throw new Error(`SMS API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Log the notification to Firestore for history
    await logNotification({
      to,
      message,
      type,
      status: 'sent',
      sentAt: new Date().toISOString(),
      metadata,
      twilioSid: result.sid
    });
    
    console.log('✅ SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
    
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    
    // Log failed notification
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
 * Log notification to Firestore for history tracking
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
      // Return default settings if none exist
      return {
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
        twilioConfigured: false
      };
    }
    
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
}

/**
 * Send employee clock in notification
 */
export async function sendClockInNotification(employee, timestamp, job = null) {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings?.clockAlerts?.enabled) {
      console.log('Clock alerts disabled, skipping notification');
      return { success: false, reason: 'disabled' };
    }
    
    // Check if in quiet hours
    if (isQuietHours(settings.clockAlerts)) {
      console.log('In quiet hours, skipping notification');
      return { success: false, reason: 'quiet_hours' };
    }
    
    // Check if tracking this employee
    if (!settings.clockAlerts.trackAllEmployees) {
      if (!settings.clockAlerts.trackedEmployeeIds?.includes(employee.id)) {
        console.log(`Not tracking employee ${employee.name}, skipping notification`);
        return { success: false, reason: 'not_tracked' };
      }
    }
    
    const time = new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    let message = `🔵 CLOCK IN\n${employee.name} - ${time}`;
    
    if (job) {
      message += `\nJob: ${job.clientName || 'Unknown Job'}`;
      if (job.address) {
        message += `\nLocation: ${job.address}`;
      }
    }
    
    // Send to all configured phone numbers
    const results = [];
    for (const phoneNumber of settings.clockAlerts.phoneNumbers) {
      const result = await sendSMS(
        phoneNumber,
        message,
        'clock_in',
        {
          employeeId: employee.id,
          employeeName: employee.name,
          timestamp,
          jobId: job?.id
        }
      );
      results.push(result);
    }
    
    return { success: true, results };
    
  } catch (error) {
    console.error('Error sending clock in notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send employee clock out notification
 */
export async function sendClockOutNotification(employee, clockInTime, clockOutTime, job = null) {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings?.clockAlerts?.enabled) {
      console.log('Clock alerts disabled, skipping notification');
      return { success: false, reason: 'disabled' };
    }
    
    // Check if in quiet hours
    if (isQuietHours(settings.clockAlerts)) {
      console.log('In quiet hours, skipping notification');
      return { success: false, reason: 'quiet_hours' };
    }
    
    // Check if tracking this employee
    if (!settings.clockAlerts.trackAllEmployees) {
      if (!settings.clockAlerts.trackedEmployeeIds?.includes(employee.id)) {
        console.log(`Not tracking employee ${employee.name}, skipping notification`);
        return { success: false, reason: 'not_tracked' };
      }
    }
    
    const time = new Date(clockOutTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate hours worked
    const duration = calculateDuration(clockInTime, clockOutTime);
    
    let message = `🔴 CLOCK OUT\n${employee.name} - ${time}\nDuration: ${duration}`;
    
    if (job) {
      message += `\nJob: ${job.clientName || 'Unknown Job'}`;
    }
    
    // Send to all configured phone numbers
    const results = [];
    for (const phoneNumber of settings.clockAlerts.phoneNumbers) {
      const result = await sendSMS(
        phoneNumber,
        message,
        'clock_out',
        {
          employeeId: employee.id,
          employeeName: employee.name,
          clockInTime,
          clockOutTime,
          duration,
          jobId: job?.id
        }
      );
      results.push(result);
    }
    
    return { success: true, results };
    
  } catch (error) {
    console.error('Error sending clock out notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if current time is within quiet hours
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
 * Calculate duration between two timestamps
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
 * Get notification history (last N notifications)
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
    console.error('Error getting notification history:', error);
    return [];
  }
}

/**
 * Test SMS notification (sends to specified number)
 */
export async function sendTestNotification(phoneNumber) {
  const message = `✅ TEST NOTIFICATION\n\nThis is a test message from KCL Manager. Your notifications are working!\n\nTimestamp: ${new Date().toLocaleString()}`;
  
  return await sendSMS(
    phoneNumber,
    message,
    'test',
    { test: true }
  );
}