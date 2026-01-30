const functions = require('firebase-functions');
const vision = require('@google-cloud/vision');
const twilio = require('twilio');
const admin = require('firebase-admin');

admin.initializeApp();
const visionClient = new vision.ImageAnnotatorClient();

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
  
  // Store patterns
  const storePatterns = [
    { pattern: /LOWE'?S/i, name: "Lowe's" },
    { pattern: /HOME\s*DEPOT/i, name: 'Home Depot' },
    { pattern: /WAL\s*MART/i, name: 'Walmart' },
  ];
  
  // FIND VENDOR
  const fullText = lines.join(' ');
  for (const store of storePatterns) {
    if (store.pattern.test(fullText)) {
      vendor = store.name;
      console.log(">>> Vendor:", vendor);
      break;
    }
  }
  if (!vendor && lines.length > 0) vendor = lines[0];
  
  // FIND DATE
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
  
  // FIND TOTALS
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
  
  // EXTRACT LINE ITEMS - MULTI-LINE LOGIC
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
    
    // Start items section
    if (upper.includes('SALE') || upper.includes('TRANS')) {
      inItemsSection = true;
      console.log(`>>> Line ${i}: Started items section`);
      continue;
    }
    
    // Stop at totals
    if (upper.includes('SUBTOTAL') || upper.includes('TOTAL TAX')) {
      inItemsSection = false;
      console.log(`>>> Line ${i}: Ended items section`);
      break;
    }
    
    if (!inItemsSection) continue;
    if (skipWords.some(word => upper.includes(word))) continue;
    
    // Skip quantity-only lines like "5 @" or "28"
    if (/^\d+\s*@?\s*$/.test(line)) {
      console.log(`>>> Line ${i}: Skipped quantity line "${line}"`);
      continue;
    }
    
    // Check if line is JUST a price (no item description)
    if (/^\d+\.\d{2}$/.test(line)) {
      console.log(`>>> Line ${i}: Skipped standalone price "${line}"`);
      continue;
    }
    
    // PATTERN 1: Item with price on SAME line
    // Example: "130760 2-8-16 TC #2 PREM KD DOUG 105.40"
    const sameLine = line.match(/^(\d{5,})\s+(.+?)\s+(\d+\.\d{2})$/);
    if (sameLine) {
      const price = parseFloat(sameLine[3]);
      const itemName = sameLine[2].trim();
      
      if (itemName.length >= 3 && price > 0) {
        lineItems.push({
          item: itemName,
          quantity: '1',
          price: price
        });
        console.log(`>>> Line ${i}: FOUND (same line) "${itemName}" = $${price}`);
        continue;
      }
    }
    
    // PATTERN 2: Item WITHOUT price, check NEXT line for price
    // Example: "12151 100-CT 6-IN BAR TIE" followed by "12.76"
    const itemWithoutPrice = line.match(/^(\d{5,})\s+(.+)$/);
    if (itemWithoutPrice && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      
      // Check if next line is JUST a price
      const nextLinePrice = nextLine.match(/^(\d+\.\d{2})$/);
      if (nextLinePrice) {
        const price = parseFloat(nextLinePrice[1]);
        const itemName = itemWithoutPrice[2].trim();
        
        if (itemName.length >= 3 && price > 0 && price < 1000) {
          lineItems.push({
            item: itemName,
            quantity: '1',
            price: price
          });
          console.log(`>>> Line ${i}-${i+1}: FOUND (multi-line) "${itemName}" = $${price}`);
          i++; // Skip next line since we used it
          continue;
        }
      }
    }
  }
  
  console.log(`>>> Total items extracted: ${lineItems.length}`);
  
  // Use receipt total if found, otherwise calculate
  if (total === 0) {
    if (subtotal > 0 && tax > 0) {
      total = subtotal + tax;
    } else if (lineItems.length > 0) {
      total = lineItems.reduce((sum, item) => 
        sum + (parseFloat(item.price) * parseFloat(item.quantity)), 0
      );
    }
  }
  
  const result = {
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
  
  console.log("=".repeat(80));
  console.log("FINAL RESULT:");
  console.log(JSON.stringify(result, null, 2));
  console.log("=".repeat(80));
  
  return result;
}

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

exports.testFunction = functions.https.onCall(async (data, context) => {
  return { success: true, message: "Working v10 MULTILINE!", timestamp: new Date().toISOString() };
});

// ========================= SMS NOTIFICATION FUNCTIONS =========================

/**
 * Send SMS via Twilio
 * Triggered by HTTPS request from frontend
 */
exports.sendSMS = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send({ error: 'Method not allowed' });
    return;
  }

  try {
    const { to, message, type, metadata } = req.body;

    if (!to || !message) {
      res.status(400).send({ error: 'Missing required fields: to, message' });
      return;
    }

    // Get Twilio credentials from Firestore
    const settingsSnap = await admin.firestore()
      .collection('notification_settings')
      .limit(1)
      .get();

    if (settingsSnap.empty) {
      res.status(500).send({ error: 'Notification settings not configured' });
      return;
    }

    const settings = settingsSnap.docs[0].data();

    if (!settings.twilioConfigured || !settings.twilioAccountSid || !settings.twilioAuthToken) {
      res.status(500).send({ error: 'Twilio not configured' });
      return;
    }

    // Initialize Twilio client
    const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);

    // Send SMS
    const smsResult = await client.messages.create({
      body: message,
      from: settings.twilioPhoneNumber,
      to: to
    });

    console.log(`SMS sent successfully: ${smsResult.sid}`);

    // Return success
    res.status(200).send({
      success: true,
      sid: smsResult.sid,
      type: type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).send({
      error: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

/**
 * Daily cron job to send payment reminders
 * Runs every day at 8 AM PST
 */
exports.sendPaymentReminders = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Running payment reminders check...');

    try {
      // Get notification settings
      const settingsSnap = await admin.firestore()
        .collection('notification_settings')
        .limit(1)
        .get();

      if (settingsSnap.empty) {
        console.log('No notification settings found');
        return null;
      }

      const settings = settingsSnap.docs[0].data();

      if (!settings.paymentReminders?.enabled || !settings.twilioConfigured) {
        console.log('Payment reminders disabled or Twilio not configured');
        return null;
      }

      // Calculate target date (X days from now)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + settings.paymentReminders.daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get invoices due on target date
      const invoicesSnap = await admin.firestore()
        .collection('invoices')
        .where('dueDate', '==', targetDateStr)
        .where('status', '!=', 'paid')
        .get();

      if (invoicesSnap.empty) {
        console.log('No invoices due on target date:', targetDateStr);
        return null;
      }

      // Initialize Twilio
      const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);

      // Send reminders
      let sentCount = 0;
      for (const invoiceDoc of invoicesSnap.docs) {
        const invoice = invoiceDoc.data();

        if (!invoice.customerPhone) {
          console.log(`No phone number for customer: ${invoice.customerName}`);
          continue;
        }

        const message = `💰 PAYMENT REMINDER\n\n` +
          `Hi ${invoice.customerName},\n\n` +
          `Your payment of $${invoice.total} for ${invoice.description || 'services'} ` +
          `is due on ${new Date(targetDateStr).toLocaleDateString()}.\n\n` +
          `Pay via Zelle: 928-450-5733\n\n` +
          `Thank you!\n` +
          `Kings Canyon Landscaping`;

        try {
          await client.messages.create({
            body: message,
            from: settings.twilioPhoneNumber,
            to: invoice.customerPhone
          });

          // Log to Firestore
          await admin.firestore().collection('notifications_log').add({
            to: invoice.customerPhone,
            message: message,
            type: 'payment_reminder',
            status: 'sent',
            sentAt: new Date().toISOString(),
            metadata: {
              invoiceId: invoiceDoc.id,
              customerId: invoice.customerId,
              amount: invoice.total
            }
          });

          sentCount++;
          console.log(`Sent payment reminder to ${invoice.customerName}`);

        } catch (error) {
          console.error(`Failed to send to ${invoice.customerName}:`, error);
        }
      }

      console.log(`Payment reminders sent: ${sentCount}`);
      return null;

    } catch (error) {
      console.error('Error in sendPaymentReminders:', error);
      return null;
    }
  });

/**
 * Daily cron job to send job reminders
 * Runs every day at 8 AM PST
 */
exports.sendJobReminders = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Running job reminders check...');

    try {
      // Get notification settings
      const settingsSnap = await admin.firestore()
        .collection('notification_settings')
        .limit(1)
        .get();

      if (settingsSnap.empty) {
        console.log('No notification settings found');
        return null;
      }

      const settings = settingsSnap.docs[0].data();

      if (!settings.jobReminders?.enabled || !settings.twilioConfigured) {
        console.log('Job reminders disabled or Twilio not configured');
        return null;
      }

      // Calculate target date (X days from now)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + settings.jobReminders.daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get scheduled jobs on target date
      const schedulesSnap = await admin.firestore()
        .collection('schedules')
        .where('startDate', '==', targetDateStr)
        .where('status', '!=', 'cancelled')
        .where('status', '!=', 'completed')
        .get();

      if (schedulesSnap.empty) {
        console.log('No jobs scheduled for target date:', targetDateStr);
        return null;
      }

      // Get customers to find phone numbers
      const customersSnap = await admin.firestore().collection('customers').get();
      const customersMap = {};
      customersSnap.docs.forEach(doc => {
        customersMap[doc.id] = { id: doc.id, ...doc.data() };
      });

      // Initialize Twilio
      const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);

      // Send reminders
      let sentCount = 0;
      for (const scheduleDoc of schedulesSnap.docs) {
        const schedule = scheduleDoc.data();
        const customer = customersMap[schedule.customerId];

        if (!customer || !customer.phone) {
          console.log(`No phone number for customer: ${schedule.clientName}`);
          continue;
        }

        const jobDate = new Date(targetDateStr);
        const message = `📅 JOB REMINDER\n\n` +
          `Hi ${schedule.clientName},\n\n` +
          `This is a reminder about your scheduled service:\n\n` +
          `Date: ${jobDate.toLocaleDateString()}\n` +
          `Time: ${schedule.startTime || '8:00 AM'}\n\n` +
          `We look forward to serving you!\n\n` +
          `Kings Canyon Landscaping\n` +
          `928-450-5733`;

        try {
          await client.messages.create({
            body: message,
            from: settings.twilioPhoneNumber,
            to: customer.phone
          });

          // Log to Firestore
          await admin.firestore().collection('notifications_log').add({
            to: customer.phone,
            message: message,
            type: 'job_reminder',
            status: 'sent',
            sentAt: new Date().toISOString(),
            metadata: {
              scheduleId: scheduleDoc.id,
              customerId: schedule.customerId,
              jobDate: targetDateStr
            }
          });

          sentCount++;
          console.log(`Sent job reminder to ${schedule.clientName}`);

        } catch (error) {
          console.error(`Failed to send to ${schedule.clientName}:`, error);
        }
      }

      console.log(`Job reminders sent: ${sentCount}`);
      return null;

    } catch (error) {
      console.error('Error in sendJobReminders:', error);
      return null;
    }
  });