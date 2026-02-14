const functions = require('firebase-functions');
// const vision = require('@google-cloud/vision');  // Temporarily disabled - needs Vision API enabled
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

admin.initializeApp();
// const visionClient = new vision.ImageAnnotatorClient();  // Temporarily disabled

// ========================= CARRIER GATEWAY MAP =========================
const CARRIER_GATEWAYS = {
  tmobile: '@tmomail.net',
  att: '@txt.att.net',
  verizon: '@vtext.com',
  cricket: '@sms.cricketwireless.net',
  mint: '@tmomail.net',       // Mint runs on T-Mobile
  metro: '@mymetropcs.com',   // Metro by T-Mobile
  boost: '@sms.myboostmobile.com',
  uscellular: '@email.uscc.net',
  visible: '@vtext.com',      // Visible runs on Verizon
};

/**
 * Get SMS gateway email address for a phone number + carrier
 */
function getSMSGateway(phone, carrier) {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');
  // Use last 10 digits (remove country code)
  const number = digits.length > 10 ? digits.slice(-10) : digits;
  const gateway = CARRIER_GATEWAYS[carrier] || CARRIER_GATEWAYS.tmobile;
  return `${number}${gateway}`;
}

/**
 * Create a Nodemailer transporter from settings
 */
function createTransporter(gmailEmail, gmailAppPassword) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailAppPassword,
    },
  });
}

/**
 * Send email-to-SMS to a single recipient
 */
async function sendEmailToSMS(transporter, fromEmail, toGateway, message) {
  const mailOptions = {
    from: fromEmail,
    to: toGateway,
    subject: 'Kings Canyon', // Shows as label on some carriers
    text: message,
  };
  
  return await transporter.sendMail(mailOptions);
}

/**
 * Helper: Send notification to ALL admin phones
 */
async function sendToAllAdmins(settings, message, type, metadata = {}) {
  const adminPhones = settings.adminPhones || [];
  
  if (adminPhones.length === 0) {
    console.log('No admin phones configured');
    return { success: false, reason: 'no_admins' };
  }
  
  const transporter = createTransporter(settings.gmailEmail, settings.gmailAppPassword);
  const results = [];
  
  for (const adminEntry of adminPhones) {
    const gateway = getSMSGateway(adminEntry.phone, adminEntry.carrier || 'tmobile');
    
    try {
      await sendEmailToSMS(transporter, settings.gmailEmail, gateway, message);
      console.log(`Sent to ${adminEntry.name} (${gateway})`);
      
      // Log success
      await admin.firestore().collection('notifications_log').add({
        to: adminEntry.phone,
        toName: adminEntry.name,
        toGateway: gateway,
        message: message,
        type: type,
        status: 'sent',
        sentAt: new Date().toISOString(),
        metadata,
      });
      
      results.push({ name: adminEntry.name, success: true });
    } catch (error) {
      console.error(`Failed to send to ${adminEntry.name}:`, error.message);
      
      // Log failure
      await admin.firestore().collection('notifications_log').add({
        to: adminEntry.phone,
        toName: adminEntry.name,
        toGateway: gateway,
        message: message,
        type: type,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: error.message,
        metadata,
      });
      
      results.push({ name: adminEntry.name, success: false, error: error.message });
    }
  }
  
  transporter.close();
  return { success: true, results };
}

/**
 * Get notification settings from Firestore
 */
async function getSettings() {
  const snap = await admin.firestore()
    .collection('notification_settings')
    .limit(1)
    .get();
  
  if (snap.empty) return null;
  return snap.docs[0].data();
}


// ========================= RECEIPT SCANNER (UNCHANGED) =========================

function parseReceiptText(text) {
  console.log("=".repeat(80));
  console.log("MULTI-LINE PARSER STARTING");
  console.log("=".repeat(80));
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let vendor = '';
  let total = 0;
  let subtotal = 0;
  let tax = 0;
  let date = '';
  const lineItems = [];
  
  const storePatterns = [
    { pattern: /LOWE'?S/i, name: "Lowe's" },
    { pattern: /HOME\s*DEPOT/i, name: 'Home Depot' },
    { pattern: /WAL\s*MART/i, name: 'Walmart' },
  ];
  
  const fullText = lines.join(' ');
  for (const store of storePatterns) {
    if (store.pattern.test(fullText)) {
      vendor = store.name;
      console.log(">>> Vendor:", vendor);
      break;
    }
  }
  if (!vendor && lines.length > 0) vendor = lines[0];
  
  for (const line of lines) {
    let dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!dateMatch) {
      dateMatch = line.match(/(\d{2})-(\d{2})-(\d{2})/);
    }
    if (dateMatch) {
      let month, day, year;
      if (dateMatch[3].length === 2) {
        month = dateMatch[1];
        day = dateMatch[2];
        year = '20' + dateMatch[3];
      } else {
        month = dateMatch[1];
        day = dateMatch[2];
        year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
      }
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      console.log(">>> Date:", date);
      break;
    }
  }
  
  for (const line of lines) {
    const upper = line.toUpperCase();
    
    if (upper.includes('TOTAL:')) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match && !total) {
        total = parseFloat(match[1]);
        console.log(">>> Total:", total);
      }
    }
    
    if (upper.includes('SUBTOTAL:')) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match && !subtotal) {
        subtotal = parseFloat(match[1]);
        console.log(">>> Subtotal:", subtotal);
      }
    }
    
    if (upper.includes('TAX:') && !upper.includes('TOTAL')) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match && !tax) {
        tax = parseFloat(match[1]);
        console.log(">>> Tax:", tax);
      }
    }
  }
  
  console.log(">>> Extracting items (multi-line mode)...");
  
  const skipWords = [
    'TOTAL', 'SUBTOTAL', 'TAX', 'CASH', 'CHANGE', 'INVOICE', 'SALE',
    'TRANS', 'REWARDS', 'SIGN IN', 'TRACK', 'MANAGE', 'ACCOUNT',
    'HOME CENTERS', 'HIGHWAY', 'BULLHEAD CITY', "LOWE'S", 'MY LOWE',
  ];
  
  let inItemsSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    
    if (upper.includes('SALE') || upper.includes('TRANS')) {
      inItemsSection = true;
      console.log(`>>> Line ${i}: Started items section`);
      continue;
    }
    
    if (upper.includes('SUBTOTAL') || upper.includes('TOTAL TAX')) {
      inItemsSection = false;
      console.log(`>>> Line ${i}: Ended items section`);
      break;
    }
    
    if (!inItemsSection) continue;
    if (skipWords.some(word => upper.includes(word))) continue;
    
    if (/^\d+\s*@?\s*$/.test(line)) {
      console.log(`>>> Line ${i}: Skipped quantity line "${line}"`);
      continue;
    }
    
    if (/^\d+\.\d{2}$/.test(line)) {
      console.log(`>>> Line ${i}: Skipped standalone price "${line}"`);
      continue;
    }
    
    const sameLine = line.match(/^(\d{5,})\s+(.+?)\s+(\d+\.\d{2})$/);
    if (sameLine) {
      const price = parseFloat(sameLine[3]);
      const itemName = sameLine[2].trim();
      
      if (itemName.length >= 3 && price > 0) {
        lineItems.push({ item: itemName, quantity: '1', price: price });
        console.log(`>>> Line ${i}: FOUND (same line) "${itemName}" = $${price}`);
        continue;
      }
    }
    
    const itemWithoutPrice = line.match(/^(\d{5,})\s+(.+)$/);
    if (itemWithoutPrice && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      
      const nextLinePrice = nextLine.match(/^(\d+\.\d{2})$/);
      if (nextLinePrice) {
        const price = parseFloat(nextLinePrice[1]);
        const itemName = itemWithoutPrice[2].trim();
        
        if (itemName.length >= 3 && price > 0 && price < 1000) {
          lineItems.push({ item: itemName, quantity: '1', price: price });
          console.log(`>>> Line ${i}-${i+1}: FOUND (multi-line) "${itemName}" = $${price}`);
          i++;
          continue;
        }
      }
    }
  }
  
  console.log(`>>> Total items extracted: ${lineItems.length}`);
  
  if (total === 0) {
    if (subtotal > 0 && tax > 0) {
      total = subtotal + tax;
    } else if (lineItems.length > 0) {
      total = lineItems.reduce((sum, item) => 
        sum + (parseFloat(item.price) * parseFloat(item.quantity)), 0
      );
    }
  }
  
  return {
    vendor: vendor || 'Unknown Vendor',
    amount: Math.round(total * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    date: date || new Date().toISOString().split('T')[0],
    receiptNumber: '',
    category: 'materials',
    lineItems: lineItems,
    rawText: text,
  };
}

/*  TEMPORARILY DISABLED - needs Vision API enabled on this project
exports.scanReceipt = functions.https.onCall(async (data, context) => {
  console.log(">>> SCAN STARTED");
  
  try {
    if (!data.image) {
      throw new functions.https.HttpsError('invalid-argument', 'Image required');
    }
    
    const [result] = await visionClient.textDetection({
      image: { content: Buffer.from(data.image, 'base64') }
    });
    
    if (!result.textAnnotations || result.textAnnotations.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'No text detected');
    }
    
    const fullText = result.fullTextAnnotation?.text || result.textAnnotations[0]?.description || '';
    console.log(">>> OCR TEXT:");
    console.log(fullText);
    console.log("-".repeat(80));
    
    const parsed = parseReceiptText(fullText);
    
    console.log(">>> SUCCESS!");
    return { success: true, ...parsed };
    
  } catch (error) {
    console.error(">>> FAILED:", error.message);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
*/

exports.testFunction = functions.https.onCall(async (data, context) => {
  return { success: true, message: "Working v10 MULTILINE!", timestamp: new Date().toISOString() };
});


// ========================= NOTIFICATION FUNCTIONS (EMAIL-TO-SMS) =========================

/**
 * Send notification to all admins via email-to-SMS
 * Called from frontend via httpsCallable
 */
exports.sendNotification = functions.https.onCall(async (data, context) => {
  console.log('>>> sendNotification called');
  
  try {
    const { message, type, metadata } = data;
    
    if (!message) {
      throw new functions.https.HttpsError('invalid-argument', 'Message is required');
    }
    
    const settings = await getSettings();
    
    if (!settings) {
      throw new functions.https.HttpsError('failed-precondition', 'Notification settings not found');
    }
    
    if (!settings.gmailConfigured || !settings.gmailEmail || !settings.gmailAppPassword) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail not configured. Go to SMS Settings to set up.');
    }
    
    const result = await sendToAllAdmins(settings, message, type || 'general', metadata || {});
    
    console.log('>>> Notification result:', JSON.stringify(result));
    return result;
    
  } catch (error) {
    console.error('>>> sendNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Send test notification to verify setup
 */
exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  console.log('>>> sendTestNotification called');
  
  try {
    const settings = await getSettings();
    
    if (!settings || !settings.gmailConfigured) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail not configured');
    }
    
    const adminPhones = settings.adminPhones || [];
    if (adminPhones.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'No admin phones configured');
    }
    
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' });
    const message = `KCL Manager\nTest notification working!\n${now}`;
    
    const result = await sendToAllAdmins(settings, message, 'test', { test: true });
    return result;
    
  } catch (error) {
    console.error('>>> sendTestNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});


// ========================= DAILY CRON JOBS =========================

/**
 * Daily check at 8 AM Arizona time
 * - Payment reminders (invoices due soon)
 * - Overdue invoice alerts
 * - Upcoming job reminders
 */
exports.dailyNotifications = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('America/Phoenix')
  .onRun(async (context) => {
    console.log('Running daily notifications check...');
    
    try {
      const settings = await getSettings();
      
      if (!settings || !settings.gmailConfigured) {
        console.log('Gmail not configured, skipping');
        return null;
      }
      
      const adminPhones = settings.adminPhones || [];
      if (adminPhones.length === 0) {
        console.log('No admin phones, skipping');
        return null;
      }
      
      const messages = [];
      
      // ---- PAYMENT REMINDERS ----
      if (settings.paymentReminders?.enabled) {
        const daysBefore = settings.paymentReminders.daysBefore || 3;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // Find unpaid invoices due on target date
        try {
          const invoicesSnap = await admin.firestore()
            .collection('invoices')
            .where('dueDate', '==', targetDateStr)
            .get();
          
          for (const invoiceDoc of invoicesSnap.docs) {
            const inv = invoiceDoc.data();
            const status = (inv.status || '').toLowerCase();
            if (status !== 'paid') {
              messages.push({
                text: `INVOICE DUE\n${inv.clientName || inv.customerName} - $${inv.total}\nDue: ${targetDateStr}`,
                type: 'payment_reminder',
                metadata: { invoiceId: invoiceDoc.id }
              });
            }
          }
        } catch (err) {
          console.error('Error checking payment reminders:', err);
        }
        
        // Find overdue invoices
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const overdueSnap = await admin.firestore()
            .collection('invoices')
            .where('dueDate', '<', todayStr)
            .get();
          
          for (const invoiceDoc of overdueSnap.docs) {
            const inv = invoiceDoc.data();
            const status = (inv.status || '').toLowerCase();
            if (status !== 'paid') {
              const daysOverdue = Math.floor((new Date() - new Date(inv.dueDate)) / 86400000);
              messages.push({
                text: `OVERDUE\n${inv.clientName || inv.customerName} - $${inv.total}\n${daysOverdue} days past due`,
                type: 'overdue_invoice',
                metadata: { invoiceId: invoiceDoc.id }
              });
            }
          }
        } catch (err) {
          console.error('Error checking overdue invoices:', err);
        }
      }
      
      // ---- JOB REMINDERS ----
      if (settings.jobReminders?.enabled) {
        const daysBefore = settings.jobReminders.daysBefore || 1;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        try {
          const schedulesSnap = await admin.firestore()
            .collection('schedules')
            .where('startDate', '==', targetDateStr)
            .where('status', '==', 'scheduled')
            .get();
          
          for (const schedDoc of schedulesSnap.docs) {
            const sched = schedDoc.data();
            messages.push({
              text: `JOB TOMORROW\n${sched.clientName || 'Unknown'}\n${sched.startTime || '8:00 AM'}${sched.notes ? '\n' + sched.notes.substring(0, 40) : ''}`,
              type: 'job_reminder',
              metadata: { scheduleId: schedDoc.id }
            });
          }
        } catch (err) {
          console.error('Error checking job reminders:', err);
        }
      }
      
      // ---- SEND ALL MESSAGES ----
      if (messages.length > 0) {
        console.log(`Sending ${messages.length} daily notifications...`);
        
        for (const msg of messages) {
          await sendToAllAdmins(settings, msg.text, msg.type, msg.metadata);
        }
        
        console.log('Daily notifications complete');
      } else {
        console.log('No notifications to send today');
      }
      
      return null;
      
    } catch (error) {
      console.error('Error in dailyNotifications:', error);
      return null;
    }
  });

/**
 * Evening job reminder at 6 PM Arizona time
 * Reminds about tomorrow's jobs
 */
exports.eveningJobReminder = functions.pubsub
  .schedule('0 18 * * *')
  .timeZone('America/Phoenix')
  .onRun(async (context) => {
    console.log('Running evening job reminder...');
    
    try {
      const settings = await getSettings();
      
      if (!settings || !settings.gmailConfigured || !settings.jobReminders?.enabled) {
        console.log('Job reminders not enabled or Gmail not configured');
        return null;
      }
      
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const schedulesSnap = await admin.firestore()
        .collection('schedules')
        .where('startDate', '==', tomorrowStr)
        .where('status', '==', 'scheduled')
        .get();
      
      if (schedulesSnap.empty) {
        console.log('No jobs scheduled for tomorrow');
        return null;
      }
      
      // Build a summary message
      const jobs = schedulesSnap.docs.map(d => d.data());
      let message = `TOMORROW (${jobs.length} job${jobs.length > 1 ? 's' : ''}):\n`;
      jobs.forEach(j => {
        message += `- ${j.clientName || 'Unknown'} ${j.startTime || ''}\n`;
      });
      
      await sendToAllAdmins(settings, message.trim(), 'evening_reminder', {
        date: tomorrowStr,
        jobCount: jobs.length
      });
      
      return null;
      
    } catch (error) {
      console.error('Error in eveningJobReminder:', error);
      return null;
    }
  });


// ========================= CUSTOMER EMAIL FUNCTIONS =========================

/**
 * Send email to customer with PDF attachment
 * Called from frontend (BidEditor, ContractEditor, InvoiceEditor)
 */
exports.sendCustomerEmail = functions.https.onCall(async (data, context) => {
  console.log('>>> sendCustomerEmail called');
  
  try {
    const {
      customerEmail,
      customerName,
      subject,
      htmlBody,
      pdfBase64,
      pdfFilename,
      docType,      // 'bid', 'contract', or 'invoice'
      docId,
      metadata,
    } = data;
    
    if (!customerEmail || !subject) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and subject are required');
    }
    
    // Get Gmail settings
    const settings = await getSettings();
    
    if (!settings || !settings.gmailConfigured || !settings.gmailEmail || !settings.gmailAppPassword) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Gmail not configured. Go to SMS Settings to set up Gmail.'
      );
    }
    
    const transporter = createTransporter(settings.gmailEmail, settings.gmailAppPassword);
    
    // Build email
    const mailOptions = {
      from: `"Kings Canyon Landscaping" <${settings.gmailEmail}>`,
      to: customerEmail,
      subject: subject,
      html: htmlBody,
    };
    
    // Attach PDF if provided
    if (pdfBase64 && pdfFilename) {
      mailOptions.attachments = [{
        filename: pdfFilename,
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }];
    }
    
    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${customerName} (${customerEmail})`);
    
    transporter.close();
    
    // Log to Firestore
    await admin.firestore().collection('email_log').add({
      to: customerEmail,
      toName: customerName,
      subject: subject,
      docType: docType || 'general',
      docId: docId || null,
      status: 'sent',
      sentAt: new Date().toISOString(),
      sentBy: context.auth?.uid || 'unknown',
      metadata: metadata || {},
    });
    
    // Notify admins that email was sent
    if (settings.adminPhones?.length > 0) {
      const adminMsg = `EMAIL SENT\n${docType?.toUpperCase() || 'Doc'} → ${customerName}\n${customerEmail}`;
      
      // Fire and forget - don't block on admin notification
      sendToAllAdmins(settings, adminMsg, 'email_sent', {
        docType,
        docId,
        customerEmail,
      }).catch(err => console.error('Admin notify error:', err));
    }
    
    return { success: true, message: `Email sent to ${customerEmail}` };
    
  } catch (error) {
    console.error('>>> sendCustomerEmail error:', error);
    
    // Log failure
    try {
      await admin.firestore().collection('email_log').add({
        to: data.customerEmail,
        toName: data.customerName,
        subject: data.subject,
        docType: data.docType || 'general',
        docId: data.docId || null,
        status: 'failed',
        error: error.message,
        sentAt: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Error logging email failure:', logErr);
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});