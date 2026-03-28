const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');

admin.initializeApp();

// ========================= CARRIER GATEWAY MAP =========================
const CARRIER_GATEWAYS = {
  tmobile: '@tmomail.net',
  att: '@txt.att.net',
  verizon: '@vtext.com',
  cricket: '@sms.cricketwireless.net',
  mint: '@tmomail.net',
  metro: '@mymetropcs.com',
  boost: '@sms.myboostmobile.com',
  uscellular: '@email.uscc.net',
  visible: '@vtext.com',
};

function getSMSGateway(phone, carrier) {
  const digits = (phone || '').replace(/\D/g, '');
  const number = digits.length > 10 ? digits.slice(-10) : digits;
  const gateway = CARRIER_GATEWAYS[carrier] || CARRIER_GATEWAYS.tmobile;
  return `${number}${gateway}`;
}

function createTransporter(gmailEmail, gmailAppPassword) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailEmail, pass: gmailAppPassword },
  });
}

async function sendEmailToSMS(transporter, fromEmail, toGateway, message) {
  const mailOptions = {
    from: fromEmail,
    to: toGateway,
    subject: 'Kings Canyon',
    text: message,
  };

  return await transporter.sendMail(mailOptions);
}

async function sendToAllAdmins(settings, message, type, metadata = {}) {
  // SMS gateway is disabled by default now that Pushover handles admin alerts.
  // To re-enable, set smsGatewayEnabled: true in the notification_settings doc.
  if (!settings?.smsGatewayEnabled) {
    console.log(`>>> sendToAllAdmins: SMS gateway disabled, skipping type="${type}"`);
    return { success: false, reason: 'sms_gateway_disabled' };
  }

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

      await admin.firestore().collection('notifications_log').add({
        to: adminEntry.phone,
        toName: adminEntry.name,
        toGateway: gateway,
        message,
        type,
        status: 'sent',
        sentAt: new Date().toISOString(),
        metadata,
      });

      results.push({ name: adminEntry.name, success: true });
    } catch (error) {
      console.error(`Failed to send to ${adminEntry.name}:`, error.message);

      await admin.firestore().collection('notifications_log').add({
        to: adminEntry.phone,
        toName: adminEntry.name,
        toGateway: gateway,
        message,
        type,
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

async function getSettings() {
  const snap = await admin.firestore().collection('notification_settings').limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// Fallback Pushover credentials — used when Firestore notification_settings
// does not have pushoverApiKey / pushoverUserKey populated.
// These match the values in src/pushoverNotificationService.js.
const PUSHOVER_TOKEN_FALLBACK = 'aka88i2ehjtm4r47d3zuqz7bhionvu'; // KCL Manager API Token
const PUSHOVER_USER_FALLBACK  = 'gnh1nvir8hovia25ohsdoq2ys8x1n3'; // KCL Alerts Group Key

async function sendPushoverNotification(title, message, priority = 0, sound = 'pushover') {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    console.warn('>>> sendPushoverNotification: could not load settings, using fallback credentials');
  }

  // If Pushover is explicitly disabled in Firestore, respect that and skip.
  // Missing / undefined = not explicitly disabled, so we proceed.
  if (settings?.pushoverEnabled === false) {
    console.log('>>> sendPushoverNotification: Pushover disabled in settings, skipping');
    return { success: false, reason: 'pushover_disabled' };
  }

  // Prefer Firestore-configured keys; fall back to hardcoded constants so the
  // function works even before the admin has populated notification_settings.
  const apiToken = settings?.pushoverApiKey  || PUSHOVER_TOKEN_FALLBACK;
  const userKey  = settings?.pushoverUserKey || PUSHOVER_USER_FALLBACK;

  if (!apiToken || !userKey) {
    console.warn('>>> sendPushoverNotification: no credentials available');
    return { success: false, reason: 'pushover_not_configured' };
  }

  try {
    // Pushover requires application/x-www-form-urlencoded — NOT JSON.
    const formData = new URLSearchParams();
    formData.append('token',    apiToken);
    formData.append('user',     userKey);
    formData.append('title',    title);
    formData.append('message',  message);
    formData.append('priority', priority);
    formData.append('sound',    sound);

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    formData.toString(),
    });

    const result = await response.json();

    if (result.status !== 1) {
      console.error('>>> Pushover API error:', result.errors);
      return { success: false, reason: 'pushover_api_error', error: result };
    }

    console.log(`>>> Pushover sent OK: "${title}"`);
    return { success: true };
  } catch (error) {
    console.error('>>> Pushover fetch exception:', error.message);
    return { success: false, reason: 'pushover_exception', error: error.message };
  }
}

// ========================= RECEIPT SCANNER (Claude Vision) =========================

function detectMediaType(base64String) {
  const prefix = base64String.substring(0, 16);
  if (prefix.startsWith('/9j/')) return 'image/jpeg';
  if (prefix.startsWith('iVBORw0KGgo')) return 'image/png';
  if (prefix.startsWith('UklGR')) return 'image/webp';
  if (prefix.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

exports.scanReceipt = functions.runWith({ secrets: ['ANTHROPIC_API_KEY'] }).https.onCall(async (data, context) => {
  console.log('>>> SCAN STARTED (Claude Vision)');

  try {
    if (!data.image) {
      throw new functions.https.HttpsError('invalid-argument', 'Image required');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Anthropic API key not configured. Add ANTHROPIC_API_KEY to functions/.env'
      );
    }

    const mediaType = detectMediaType(data.image);
    console.log('>>> Detected media type:', mediaType);

    const prompt = `You are a receipt scanner for a landscaping company. Analyze this receipt image carefully and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Use this exact structure:
{
  "vendor": "store name",
  "amount": 0.00,
  "subtotal": 0.00,
  "tax": 0.00,
  "date": "YYYY-MM-DD",
  "receiptNumber": "",
  "category": "materials",
  "lineItems": [
    { "item": "item name", "quantity": "1", "price": 0.00 }
  ],
  "description": "short comma-separated summary of top items",
  "rawText": "full text you read from the receipt"
}

Rules:
- amount = the final total the customer paid (after tax)
- subtotal = pre-tax total (0 if not shown)
- tax = tax amount (0 if not shown)
- date must be YYYY-MM-DD format; use today's date if not found
- receiptNumber = transaction/receipt number if visible, otherwise ""
- category: choose the best fit from: materials, fuel, equipment, food, other
- lineItems: list every individual item purchased with its price; quantity as a string
- description: comma-separated list of the first 5 item names
- rawText: transcribe all text you can read from the receipt
- Return ONLY the JSON object, absolutely nothing else`;

    console.log('>>> Calling Anthropic API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: data.image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('>>> Anthropic API HTTP error:', response.status, errText);
      throw new functions.https.HttpsError('internal', `Claude API error ${response.status}: ${errText}`);
    }

    const claudeResult = await response.json();
    console.log('>>> Anthropic response received, stop_reason:', claudeResult.stop_reason);

    const rawOutput = claudeResult.content?.[0]?.text || '';
    console.log('>>> Claude raw output:');
    console.log(rawOutput);
    console.log('-'.repeat(80));

    let parsed;
    try {
      parsed = JSON.parse(rawOutput.trim());
    } catch (parseErr) {
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error('>>> JSON parse failed. Raw output was:', rawOutput);
        throw new Error('Claude did not return valid JSON. Raw: ' + rawOutput.substring(0, 200));
      }
    }

    parsed.amount = parseFloat(parsed.amount) || 0;
    parsed.subtotal = parseFloat(parsed.subtotal) || 0;
    parsed.tax = parseFloat(parsed.tax) || 0;
    parsed.lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];

    console.log(`>>> SUCCESS: vendor=${parsed.vendor}, total=${parsed.amount}, items=${parsed.lineItems.length}`);
    return { success: true, ...parsed };
  } catch (error) {
    console.error('>>> SCAN FAILED:', error.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.testFunction = functions.https.onCall(async () => {
  return { success: true, message: 'Working v14!', timestamp: new Date().toISOString() };
});

// ========================= EMPLOYEE INVITE SYSTEM =========================

function generateInviteToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

exports.sendEmployeeInvite = functions.https.onCall(async (data, context) => {
  console.log('>>> sendEmployeeInvite called for:', data.email);

  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const {
      name, email, role, jobTitle, phoneNumber,
      employmentType, hourlyRate, annualSalary, paySchedule,
      requireGps, invitedBy, resend,
    } = data;

    if (!name || !email) {
      throw new functions.https.HttpsError('invalid-argument', 'Name and email are required');
    }

    try {
      const existing = await admin.auth().getUserByEmail(email.toLowerCase());
      if (existing && !resend) {
        throw new functions.https.HttpsError(
          'already-exists',
          'An account with this email already exists. Use Resend Invite if they need a new link.'
        );
      }
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
      } else if (authErr instanceof functions.https.HttpsError) {
        throw authErr;
      }
    }

    const existingInvites = await admin.firestore()
      .collection('invites')
      .where('email', '==', email.toLowerCase())
      .where('used', '==', false)
      .get();

    for (const inviteDoc of existingInvites.docs) {
      await inviteDoc.ref.update({ used: true, invalidatedAt: new Date().toISOString() });
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await admin.firestore().collection('invites').doc(token).set({
      token,
      name,
      email: email.toLowerCase(),
      role: role || 'crew',
      jobTitle: jobTitle || 'Crew Member',
      phoneNumber: phoneNumber || '',
      employmentType: employmentType || 'hourly',
      hourlyRate: hourlyRate || 0,
      annualSalary: annualSalary || 0,
      paySchedule: paySchedule || 'semi-monthly',
      requireGps: requireGps !== false,
      invitedBy: invitedBy || context.auth.uid,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    console.log('>>> Invite token created:', token.substring(0, 8) + '...');

    const settings = await getSettings();
    const appUrl = 'https://kcl-manager-test.web.app';
    const inviteUrl = `${appUrl}/public/invite/${token}`;

    if (settings?.gmailConfigured && settings?.gmailEmail && settings?.gmailAppPassword) {
      const transporter = createTransporter(settings.gmailEmail, settings.gmailAppPassword);

      const mailOptions = {
        from: `"Kings Canyon Landscaping" <${settings.gmailEmail}>`,
        to: email,
        subject: `You're invited to join Kings Canyon Landscaping`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2e7d32; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0;">KCL Manager</h1>
              <p style="color: #c8e6c9; margin: 8px 0 0;">Kings Canyon Landscaping</p>
            </div>

            <div style="padding: 32px 24px;">
              <h2 style="color: #212121;">Hi ${name},</h2>
              <p style="color: #546e7a; font-size: 16px;">
                You've been invited to join the Kings Canyon Landscaping team on KCL Manager.
              </p>

              <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 4px 0;"><strong>Role:</strong> ${role === 'admin' ? 'Admin' : 'Crew Member'}</p>
                <p style="margin: 4px 0;"><strong>Job Title:</strong> ${jobTitle || 'Crew Member'}</p>
                <p style="margin: 4px 0;"><strong>Pay Type:</strong> ${employmentType === 'salary' ? 'Salary' : 'Hourly'}</p>
              </div>

              <p style="color: #546e7a;">
                Click the button below to create your password and set up your account.
                This link expires in <strong>72 hours</strong>.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}"
                   style="background: #2e7d32; color: white; padding: 14px 32px; border-radius: 6px;
                          text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
                  Set Up My Account
                </a>
              </div>

              <p style="color: #9e9e9e; font-size: 13px;">
                If the button doesn't work, copy this link into your browser:<br/>
                <a href="${inviteUrl}" style="color: #2e7d32;">${inviteUrl}</a>
              </p>

              <p style="color: #9e9e9e; font-size: 13px;">
                After setting your password, you will be asked to sign a company NDA before accessing the app.
              </p>
            </div>

            <div style="background: #f5f5f5; padding: 16px; text-align: center;">
              <p style="color: #9e9e9e; font-size: 12px; margin: 0;">
                Kings Canyon Landscaping LLC — Bullhead City, AZ
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      transporter.close();
      console.log('>>> Invite email sent to:', email);
    } else {
      console.warn('>>> Gmail not configured — invite token created but email not sent');
    }

    await admin.firestore().collection('notifications_log').add({
      type: 'employee_invite',
      to: email,
      toName: name,
      status: settings?.gmailConfigured ? 'sent' : 'token_only',
      sentAt: new Date().toISOString(),
      inviteToken: token.substring(0, 8) + '...',
    });

    return {
      success: true,
      message: settings?.gmailConfigured
        ? `Invite email sent to ${email}`
        : `Invite token created but Gmail not configured — share this link manually: ${inviteUrl}`,
      inviteUrl,
    };
  } catch (error) {
    console.error('>>> sendEmployeeInvite error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.acceptEmployeeInvite = functions.https.onCall(async (data) => {
  console.log('>>> acceptEmployeeInvite called');

  try {
    const { token, password } = data;

    if (!token || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'Token and password are required');
    }

    if (password.length < 8) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters');
    }

    const inviteRef = admin.firestore().collection('invites').doc(token);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid invite link');
    }

    const invite = inviteSnap.data();

    if (invite.used) {
      throw new functions.https.HttpsError('failed-precondition', 'This invite has already been used');
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new functions.https.HttpsError('failed-precondition', 'This invite link has expired. Ask your manager to send a new one.');
    }

    console.log('>>> Creating Firebase Auth user for:', invite.email);

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: invite.email,
        password,
        displayName: invite.name,
      });
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        userRecord = await admin.auth().getUserByEmail(invite.email);
        await admin.auth().updateUser(userRecord.uid, { password });
        console.log('>>> Updated password for existing user:', invite.email);
      } else {
        throw authErr;
      }
    }

    console.log('>>> Firebase Auth user created/updated:', userRecord.uid);

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name: invite.name,
      email: invite.email,
      role: invite.role || 'crew',
      jobTitle: invite.jobTitle || 'Crew Member',
      phoneNumber: invite.phoneNumber || '',
      employmentType: invite.employmentType || 'hourly',
      hourlyRate: invite.hourlyRate || 0,
      annualSalary: invite.annualSalary || 0,
      paySchedule: invite.paySchedule || 'semi-monthly',
      requireGps: invite.requireGps !== false,
      active: true,
      firstLogin: true,
      ndaSigned: false,
      ndaSignedDate: null,
      invitedBy: invite.invitedBy || null,
      createdAt: new Date().toISOString(),
      createdViaInvite: true,
    }, { merge: true });

    console.log('>>> Firestore user document created for UID:', userRecord.uid);

    await inviteRef.update({
      used: true,
      usedAt: new Date().toISOString(),
      createdUserId: userRecord.uid,
    });

    return { success: true, message: 'Account created successfully' };
  } catch (error) {
    console.error('>>> acceptEmployeeInvite error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ========================= NOTIFICATION FUNCTIONS (EMAIL-TO-SMS) =========================

exports.sendNotification = functions.https.onCall(async (data, context) => {
  console.log('>>> sendNotification called');

  try {
    const { message, type, metadata } = data;
    if (!message) throw new functions.https.HttpsError('invalid-argument', 'Message is required');

    const settings = await getSettings();
    if (!settings) throw new functions.https.HttpsError('failed-precondition', 'Notification settings not found');

    if (!settings.gmailConfigured || !settings.gmailEmail || !settings.gmailAppPassword) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail not configured. Go to SMS Settings to set up.');
    }

    const result = await sendToAllAdmins(settings, message, type || 'general', metadata || {});
    return result;
  } catch (error) {
    console.error('>>> sendNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.sendTestNotification = functions.https.onCall(async () => {
  console.log('>>> sendTestNotification called');

  try {
    const settings = await getSettings();
    if (!settings || !settings.gmailConfigured) throw new functions.https.HttpsError('failed-precondition', 'Gmail not configured');

    const adminPhones = settings.adminPhones || [];
    if (adminPhones.length === 0) throw new functions.https.HttpsError('failed-precondition', 'No admin phones configured');

    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' });
    const message = `KCL Manager\nTest notification working!\n${now}`;
    return await sendToAllAdmins(settings, message, 'test', { test: true });
  } catch (error) {
    console.error('>>> sendTestNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ========================= DAILY CRON JOBS =========================

exports.dailyNotifications = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('America/Phoenix')
  .onRun(async () => {
    console.log('Running daily notifications check...');

    try {
      const settings = await getSettings();
      if (!settings || !settings.gmailConfigured) return null;

      const messages = [];

      if (settings.paymentReminders?.enabled) {
        const daysBefore = settings.paymentReminders.daysBefore || 3;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split('T')[0];

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
                metadata: { invoiceId: invoiceDoc.id },
              });
            }
          }
        } catch (err) {
          console.error('Error checking payment reminders:', err);
        }

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
                metadata: { invoiceId: invoiceDoc.id },
              });
            }
          }
        } catch (err) {
          console.error('Error checking overdue invoices:', err);
        }
      }

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
              metadata: { scheduleId: schedDoc.id },
            });
          }
        } catch (err) {
          console.error('Error checking job reminders:', err);
        }
      }

      for (const msg of messages) {
        await sendToAllAdmins(settings, msg.text, msg.type, msg.metadata);
      }

      return null;
    } catch (error) {
      console.error('Error in dailyNotifications:', error);
      return null;
    }
  });

exports.eveningJobReminder = functions.pubsub
  .schedule('0 18 * * *')
  .timeZone('America/Phoenix')
  .onRun(async () => {
    console.log('Running evening job reminder...');

    try {
      const settings = await getSettings();
      if (!settings || !settings.gmailConfigured || !settings.jobReminders?.enabled) return null;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const schedulesSnap = await admin.firestore()
        .collection('schedules')
        .where('startDate', '==', tomorrowStr)
        .where('status', '==', 'scheduled')
        .get();

      if (schedulesSnap.empty) return null;

      const jobs = schedulesSnap.docs.map(d => d.data());
      let message = `TOMORROW (${jobs.length} job${jobs.length > 1 ? 's' : ''}):\n`;
      jobs.forEach(j => { message += `- ${j.clientName || 'Unknown'} ${j.startTime || ''}\n`; });

      await sendToAllAdmins(settings, message.trim(), 'evening_reminder', {
        date: tomorrowStr,
        jobCount: jobs.length,
      });

      return null;
    } catch (error) {
      console.error('Error in eveningJobReminder:', error);
      return null;
    }
  });

// ========================= CUSTOMER EMAIL FUNCTIONS =========================

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
      docType,
      docId,
      metadata,
    } = data;

    if (!customerEmail || !subject) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and subject are required');
    }

    const settings = await getSettings();
    if (!settings || !settings.gmailConfigured || !settings.gmailEmail || !settings.gmailAppPassword) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail not configured. Go to SMS Settings to set up Gmail.');
    }

    const transporter = createTransporter(settings.gmailEmail, settings.gmailAppPassword);

    const mailOptions = {
      from: `"Kings Canyon Landscaping" <${settings.gmailEmail}>`,
      to: customerEmail,
      subject,
      html: htmlBody,
    };

    if (pdfBase64 && pdfFilename) {
      mailOptions.attachments = [{
        filename: pdfFilename,
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }];
    }

    await transporter.sendMail(mailOptions);
    transporter.close();

    await admin.firestore().collection('email_log').add({
      to: customerEmail,
      toName: customerName,
      subject,
      docType: docType || 'general',
      docId: docId || null,
      status: 'sent',
      sentAt: new Date().toISOString(),
      sentBy: context.auth?.uid || 'unknown',
      metadata: metadata || {},
    });

    return { success: true, message: `Email sent to ${customerEmail}` };
  } catch (error) {
    console.error('>>> sendCustomerEmail error:', error);

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

exports.notifySignature = functions.https.onCall(async (data) => {
  console.log('>>> notifySignature called');

  try {
    const { docType, docId, customerName, amount } = data;
    if (!docType || !docId || !customerName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const isBid = docType === 'bid';
    const typeLabel = isBid ? 'BID ACCEPTED' : 'CONTRACT SIGNED';
    const pushoverTitle = isBid ? 'KCL Bid Signed' : 'KCL Contract Signed';
    const amountLine = amount ? `\n$${parseFloat(amount).toFixed(2)}` : '';
    const smsMessage = `${typeLabel}\n${customerName}${amountLine}\nCheck the app for details`;
    const pushoverMessage = `${customerName}${amountLine}\nCheck the app for details`;

    const settings = await getSettings();
    if (!settings) {
      throw new functions.https.HttpsError('failed-precondition', 'Notification settings not found');
    }

    const pushoverResult = await sendPushoverNotification(
      pushoverTitle,
      pushoverMessage
    );

    let smsSent = false;
    if (!pushoverResult.success &&
        settings.adminPhones?.length > 0 &&
        settings.gmailConfigured &&
        settings.gmailEmail &&
        settings.gmailAppPassword) {
      await sendToAllAdmins(settings, smsMessage, 'signature_received', {
        docType,
        docId,
        customerName,
        amount: amount || null,
        fallback: 'sms_gateway',
      });
      smsSent = true;
    }

    await admin.firestore().collection('notifications_log').add({
      type: 'signature_received',
      docType,
      docId,
      customerName,
      message: smsMessage,
      pushover: pushoverResult.success,
      sentAt: new Date().toISOString(),
    });

    return {
      success: true,
      pushover: pushoverResult.success,
      fallbackSms: smsSent,
    };
  } catch (error) {
    console.error('>>> notifySignature error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ========================= BID SIGNING =========================

exports.getPublicBid = functions.https.onCall(async (data) => {
  console.log('>>> getPublicBid called');

  try {
    const { bidId, signingToken } = data || {};

    if (!bidId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing bidId');
    }

    if (!signingToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing signingToken');
    }

    const bidRef = admin.firestore().collection('bids').doc(bidId);
    const bidSnap = await bidRef.get();

    if (!bidSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Bid not found');
    }

    const bid = bidSnap.data() || {};

    if (!bid.signingToken || bid.signingToken !== signingToken) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid or expired signing link');
    }

    return {
      success: true,
      bid: {
        customerName: bid.customerName || '',
        amount: bid.amount || 0,
        description: bid.description || '',
        materials: bid.materials || '',
        status: bid.status || '',
        clientSignedAt: bid.clientSignedAt || null,
        clientSignature: bid.clientSignature || null,
        hasAiConceptRenderingImage: !!bid.aiConceptRenderingImageUrl,
        aiConceptRenderingImageUrl: bid.aiConceptRenderingImageUrl || null,
        aiConceptRenderingStyle: bid.aiConceptRenderingStyle || '',
        aiConceptRenderingPrompt: bid.aiConceptRenderingPrompt || '',
        hasAiConceptRendering: !!bid.aiConceptRendering,
        aiConceptRendering: bid.aiConceptRendering || null,
      },
    };
  } catch (error) {
    console.error('>>> getPublicBid error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.signPublicBid = functions.https.onCall(async (data) => {
  console.log('>>> signPublicBid called');

  const { bidId, signatureData, signingToken } = data || {};

  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing bidId');
  }

  if (!signatureData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing signatureData');
  }

  const bidRef = admin.firestore().collection('bids').doc(bidId);
  const bidSnap = await bidRef.get();

  if (!bidSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Bid not found');
  }

  const bid = bidSnap.data() || {};

  console.log('>>> signPublicBid loaded bid:', JSON.stringify({
    bidId,
    status: bid.status || null,
    hasClientSignedAt: !!bid.clientSignedAt,
    hasClientSignature: !!bid.clientSignature,
    hasSigningToken: !!bid.signingToken,
  }));

  if (bid.signingToken && signingToken && bid.signingToken !== signingToken) {
    console.error('>>> signPublicBid token mismatch', JSON.stringify({ bidId }));
    throw new functions.https.HttpsError('permission-denied', 'Invalid or expired signing link');
  }

  if (bid.signingToken && !signingToken) {
    console.error('>>> signPublicBid missing signing token', JSON.stringify({ bidId }));
    throw new functions.https.HttpsError('permission-denied', 'Missing signing token');
  }

  const alreadySigned = !!(
    bid.clientSignedAt ||
    bid.clientSignature ||
    bid.status === 'Accepted' ||
    bid.status === 'Fully Signed'
  );

  if (alreadySigned) {
    console.log('>>> signPublicBid already signed:', JSON.stringify({
      bidId,
      clientSignedAt: bid.clientSignedAt || null,
      status: bid.status || null,
    }));

    return {
      success: true,
      alreadySigned: true,
      bidId,
      signedAt: bid.clientSignedAt || null,
      status: bid.status || 'Accepted',
    };
  }

  const timestamp = new Date().toISOString();

  await bidRef.update({
    clientSignature: signatureData,
    clientSignedAt: timestamp,
    contractorSignedAt: timestamp,
    status: 'Accepted',
    lastUpdated: timestamp,
  });

  console.log('>>> Bid accepted by client:', bidId);

  // Auto-create Contract + Invoice + Job when bid is accepted
  try {
    // Generate a signing token so Darren can send the contract link immediately
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let signingToken = '';
    for (let i = 0; i < 48; i++) {
      signingToken += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Shared base fields used by all three documents
    const packageBase = {
      bidId,
      clientName: bid.customerName || '',
      customerName: bid.customerName || '',
      customerId: bid.customerId || null,
      amount: bid.amount || 0,
      description: bid.description || '',
      materials: bid.materials || '',
      notes: bid.notes || '',
      status: 'Pending',
      createdAt: timestamp,
      source: 'bid_signed',
    };

    // 1. Contract — signingToken lets Darren send the link right away
    const contractRef = await admin.firestore().collection('contracts').add({
      ...packageBase,
      type: 'contract',
      signingToken,
      clientEmail: bid.clientEmail || bid.customerEmail || '',
    });

    // 2. Invoice
    const invoiceRef = await admin.firestore().collection('invoices').add({
      ...packageBase,
      type: 'invoice',
      subtotal: bid.amount || 0,
      tax: 0,
      total: bid.amount || 0,
      dueDate: null,
    });

    // 3. Job folder
    const jobRef = await admin.firestore().collection('jobs').add({
      ...packageBase,
      type: 'job',
      contractId: contractRef.id,
      invoiceId: invoiceRef.id,
      photos: [],
    });

    // Back-link all three documents to each other
    await contractRef.update({ invoiceId: invoiceRef.id, jobId: jobRef.id });
    await invoiceRef.update({ contractId: contractRef.id, jobId: jobRef.id });

    console.log('>>> Auto-created job package for bid:', bidId, JSON.stringify({
      contractId: contractRef.id,
      invoiceId: invoiceRef.id,
      jobId: jobRef.id,
    }));
  } catch (pkgError) {
    console.error('>>> Job package creation failed (non-blocking):', pkgError.message);
  }

  try {
    const amountStr = bid.amount ? `\n$${parseFloat(bid.amount).toFixed(2)}` : '';
    const pushoverMessage = `${bid.customerName || 'Customer'} signed bid ${bidId}${amountStr}`;
    const smsMessage = `BID ACCEPTED\n${bid.customerName || 'Customer'}${amountStr}\nCheck the app for details`;

    const pushoverResult = await sendPushoverNotification('KCL Bid Signed', pushoverMessage);

    let delivery = 'pushover';
    if (!pushoverResult.success && pushoverResult.reason !== 'pushover_disabled') {
      const settings = await getSettings();
      if (
        settings?.adminPhones?.length > 0 &&
        settings?.gmailConfigured &&
        settings?.gmailEmail &&
        settings?.gmailAppPassword
      ) {
        await sendToAllAdmins(settings, smsMessage, 'bid_signed', {
          bidId,
          customerName: bid.customerName || null,
          amount: bid.amount || null,
          fallback: 'sms_gateway',
        });
        delivery = 'sms_fallback';
      } else {
        delivery = 'skipped';
      }
    }

    await admin.firestore().collection('notifications_log').add({
      type: 'bid_signed',
      bidId,
      docId: bidId,
      customerName: bid.customerName || null,
      amount: bid.amount || null,
      delivery,
      pushover: pushoverResult.success,
      pushoverReason: pushoverResult.success ? null : (pushoverResult.reason || 'unknown'),
      sentAt: new Date().toISOString(),
    });

    console.log('>>> signPublicBid notification complete:', JSON.stringify({
      bidId,
      delivery,
      pushover: pushoverResult.success,
    }));
  } catch (notifyError) {
    console.error('>>> signPublicBid notify error (non-blocking):', notifyError.message);

    try {
      await admin.firestore().collection('notifications_log').add({
        type: 'bid_signed',
        bidId,
        docId: bidId,
        customerName: bid.customerName || null,
        amount: bid.amount || null,
        delivery: 'error',
        pushover: false,
        error: notifyError.message || 'Unknown notification error',
        sentAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('>>> signPublicBid failed to write notifications_log error row:', logError.message);
    }
  }

  return {
    success: true,
    alreadySigned: false,
    bidId,
    signedAt: timestamp,
    status: 'Accepted',
  };
});

// ========================= BID AUTO-ARCHIVE =========================

exports.autoBidArchive = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Phoenix')
  .onRun(async () => {
    console.log('>>> autoBidArchive running');

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const twentyThreeDaysAgo = new Date(now.getTime() - 23 * 86400000);

      const bidsSnap = await admin.firestore().collection('bids').get();
      let archived = 0;
      let warned = 0;

      const settingsSnap = await admin.firestore()
        .collection('notification_settings').limit(1).get();
      const settings = settingsSnap.empty ? null : settingsSnap.docs[0].data();

      const sendPushover = async (message) => {
        if (!settings || !settings.pushoverEnabled || !settings.pushoverApiKey || !settings.pushoverUserKey) return;
        try {
          await fetch('https://api.pushover.net/1/messages.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: settings.pushoverApiKey,
              user: settings.pushoverUserKey,
              title: 'KCL Bid Archive Notice',
              message,
              priority: 0,
            }),
          });
        } catch (e) {
          console.error('Pushover error:', e.message);
        }
      };

      for (const bidDoc of bidsSnap.docs) {
        const bid = bidDoc.data();

        if (bid.status === 'archived' || bid.status === 'cancelled') continue;
        if (bid.clientSignature && bid.contractorSignature) continue;
        if (bid.warningSent30) continue;

        const refDate = bid.updatedAt
          ? new Date(bid.updatedAt)
          : bid.createdAt
          ? new Date(bid.createdAt)
          : null;

        if (!refDate) continue;

        if (refDate <= thirtyDaysAgo) {
          await bidDoc.ref.update({
            status: 'archived',
            archivedAt: now.toISOString(),
            archivedBy: 'auto',
          });
          archived++;
          console.log(`Archived bid for ${bid.customerName} (${bidDoc.id})`);

          await sendPushover(
            `📁 Bid AUTO-ARCHIVED\n${bid.customerName} — $${parseFloat(bid.amount || 0).toFixed(2)}\nNot edited in 30 days. View archive in the Bids page.`
          );

          await admin.firestore().collection('notifications_log').add({
            type: 'bid_archived',
            bidId: bidDoc.id,
            customerName: bid.customerName,
            message: `Bid for ${bid.customerName} auto-archived after 30 days`,
            sentAt: now.toISOString(),
          });
        } else if (refDate <= twentyThreeDaysAgo && !bid.warningSent30) {
          const daysLeft = Math.ceil((refDate.getTime() + 30 * 86400000 - now.getTime()) / 86400000);

          await sendPushover(
            `⚠️ Bid Expiring Soon\n${bid.customerName} — $${parseFloat(bid.amount || 0).toFixed(2)}\nArchives in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} if not accepted or edited.`
          );

          await bidDoc.ref.update({ warningSent30: true });
          warned++;
          console.log(`Warning sent for ${bid.customerName} (${daysLeft} days left)`);
        }
      }

      console.log(`autoBidArchive complete: ${archived} archived, ${warned} warnings sent`);
      return null;
    } catch (error) {
      console.error('Error in autoBidArchive:', error);
      return null;
    }
  });

// ========================= AI BID ASSISTANT PROXY =========================

exports.bidAssistant = functions.runWith({ secrets: ['ANTHROPIC_API_KEY'] }).https.onCall(async (data) => {
  const { messages, photos } = data;

  if (!messages || !Array.isArray(messages)) {
    throw new functions.https.HttpsError('invalid-argument', 'Messages array required');
  }

  const SYSTEM_PROMPT = `You are an expert bid assistant for Kings Canyon Landscaping LLC, a full-service contractor based in Bullhead City, Arizona serving Bullhead City, Fort Mohave, Mohave Valley, and Laughlin NV.

CRITICAL: KCL takes on ALL types of work — not just landscaping. Never refuse or redirect a job. Price everything.

Services include but are not limited to:
- Desert landscaping, rock/gravel, weed removal, yard cleanup, grading, drainage
- Irrigation systems, sprinkler repair and installation
- Tree and shrub trimming, hauling, debris removal
- Concrete, pavers, patios, walkways, driveways
- Fencing, block walls, retaining walls
- Outdoor structures: pergolas, shade structures, ramadas
- Interior/exterior repairs: flooring, drywall, stucco, plywood, ceilings, roofing
- Painting interior and exterior
- General handyman and construction work of any kind

Labor rate: $60/hour for all work types.

RULES — follow these strictly:
1. NEVER say any job is outside KCL services. Price it.
2. NEVER ask for more details or photos. Make reasonable assumptions and give a number.
3. If photos are provided, analyze them to improve accuracy.
4. Always give a concrete bid. If uncertain, state your assumptions in reasoning.
5. For any job description respond ONLY with this JSON (no markdown, no code fences, no extra text):
{
  "description": "Full professional scope of work ready to paste into the bid",
  "materials": "Itemized materials list with quantities",
  "estimatedHours": 8,
  "laborCost": 480,
  "materialsCost": 600,
  "recommendedAmount": 1200,
  "reasoning": "How you arrived at the numbers and any assumptions made"
}

Only respond in plain text if the user asks a general non-job question. Otherwise always return JSON.

If the user asks to adjust the margin (e.g. "bump up the margin 10%", "add 20% profit", "increase the bid"), recalculate recommendedAmount accordingly and return updated JSON with the new amount and updated reasoning explaining the margin change.`;

  const imageBlocks = (photos && photos.length > 0) ? photos.map(base64 => {
    let mediaType = 'image/jpeg';
    if (base64.startsWith('iVBORw0KGgo')) mediaType = 'image/png';
    else if (base64.startsWith('UklGR')) mediaType = 'image/webp';
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    };
  }) : [];

  const apiMessages = messages.map((msg) => {
    if (msg.role === 'user' && imageBlocks.length > 0) {
      const textContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: textContent },
        ],
      };
    }
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
    }
    return msg;
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', result);
      throw new functions.https.HttpsError('internal', 'AI service error');
    }

    return { text: result.content?.[0]?.text || '' };
  } catch (error) {
    console.error('bidAssistant error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ========================= AI LANDSCAPE RENDERING =========================

exports.generateLandscapeRendering = functions
  .runWith({ secrets: ['OPENAI_API_KEY'], timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data) => {
    const { bidId, stylePreset, projectType, dimensions, focalElements, specialNotes } = data || {};

    if (!bidId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing bidId');
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'not_configured',
        message: 'AI visual rendering requires an OpenAI API key. Please ask your administrator to configure the OPENAI_API_KEY secret in Firebase.',
      };
    }

    const dimStr =
      dimensions?.width && dimensions?.length
        ? `${dimensions.width} ${dimensions.unit || 'ft'} wide by ${dimensions.length} ${dimensions.unit || 'ft'} long`
        : 'residential-scale';

    const prompt = [
      `Photorealistic professional landscape architecture rendering of a ${stylePreset || 'Desert Modern'} desert garden.`,
      `Project type: ${projectType || 'Planter Bed'}, ${dimStr} area.`,
      focalElements ? `Featured plants and hardscape: ${focalElements}.` : '',
      specialNotes ? `Special notes: ${specialNotes}.` : '',
      'Arizona residential property, daytime golden hour lighting, lush established plants, clean polished look.',
      'Ultra-realistic, high resolution, magazine-quality landscape photography. No people, no text overlays.',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'hd',
          response_format: 'url',
        }),
      });

      if (!openAiRes.ok) {
        const errBody = await openAiRes.json().catch(() => ({}));
        console.error('OpenAI DALL-E error:', errBody);
        const msg = errBody?.error?.message || 'Image generation failed.';
        return { success: false, error: 'generation_failed', message: msg };
      }

      const openAiData = await openAiRes.json();
      const tempImageUrl = openAiData?.data?.[0]?.url;

      if (!tempImageUrl) {
        return { success: false, error: 'no_image', message: 'No image was returned from the AI service.' };
      }

      // Download the generated image
      const imgRes = await fetch(tempImageUrl);
      if (!imgRes.ok) {
        return { success: false, error: 'download_failed', message: 'Failed to retrieve the generated image.' };
      }
      const imgArrayBuffer = await imgRes.arrayBuffer();
      const imgBuffer = Buffer.from(imgArrayBuffer);

      // Upload to Firebase Storage with a stable download token
      const downloadToken = crypto.randomUUID();
      const timestamp = Date.now();
      const fileName = `ai-renderings/${bidId}/${timestamp}.png`;

      const bucket = admin.storage().bucket();
      const file = bucket.file(fileName);
      await file.save(imgBuffer, {
        metadata: {
          contentType: 'image/png',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

      const storedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;

      console.log(`>>> generateLandscapeRendering: stored at ${fileName}`);

      return {
        success: true,
        imageUrl: storedUrl,
        prompt,
        model: 'dall-e-3',
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('generateLandscapeRendering error:', err);
      return {
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred during image generation. Please try again.',
      };
    }
  });