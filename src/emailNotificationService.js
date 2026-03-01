// src/emailNotificationService.js
// EmailJS Customer Email Notification Service for KCL Manager
// Sends professional emails to customers from Kings Canyon Landscaping
// Free plan: 200 emails/month, 2 templates

import emailjs from '@emailjs/browser';

// EmailJS credentials
const SERVICE_ID = "service_x9cd8gn";
const PUBLIC_KEY = "dm2g_acIHioAYRQbU";

// Template IDs
const TEMPLATES = {
  CONTRACT_SIGNED: "template_6avxp9o",  // Contract signed - thank you + deposit request
  INVOICE_DUE: "template_nsz6vnv",       // Invoice due reminder
};

// Initialize EmailJS
emailjs.init(PUBLIC_KEY);

/**
 * Send email when a customer signs a contract
 * Triggers deposit payment request via Zelle
 */
export async function emailContractSigned(customerEmail, customerName, amount) {
  if (!customerEmail) {
    console.warn("No customer email provided for contract signed notification");
    return { success: false, error: "No email address" };
  }

  const depositAmount = (parseFloat(amount || 0) * 0.5).toFixed(2);
  const formattedAmount = parseFloat(amount || 0).toFixed(2);

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATES.CONTRACT_SIGNED, {
      customer_email: customerEmail,
      customer_name: customerName || "Valued Customer",
      amount: formattedAmount,
      deposit_amount: depositAmount,
    });

    console.log(`✅ Contract signed email sent to ${customerEmail}`);
    return { success: true, result };
  } catch (error) {
    console.error("❌ EmailJS contract signed error:", error);
    return { success: false, error: error.text || error.message };
  }
}

/**
 * Send invoice due reminder to customer
 * Called automatically when invoice is approaching due date
 */
export async function emailInvoiceDueReminder(customerEmail, customerName, amount, dueDate, description, daysUntilDue) {
  if (!customerEmail) {
    console.warn("No customer email provided for invoice due reminder");
    return { success: false, error: "No email address" };
  }

  const formattedAmount = parseFloat(amount || 0).toFixed(2);
  const formattedDate = dueDate
    ? new Date(dueDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Soon";

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATES.INVOICE_DUE, {
      customer_email: customerEmail,
      customer_name: customerName || "Valued Customer",
      amount: formattedAmount,
      due_date: formattedDate,
      description: description || "Landscaping services",
      days_until_due: daysUntilDue || 3,
    });

    console.log(`✅ Invoice due reminder sent to ${customerEmail}`);
    return { success: true, result };
  } catch (error) {
    console.error("❌ EmailJS invoice reminder error:", error);
    return { success: false, error: error.text || error.message };
  }
}