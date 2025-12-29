import jsPDF from "jspdf";
import moment from "moment";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a professional payment receipt PDF
 * @param {object} data - { payment, invoice, newTotalPaid, newRemainingBalance }
 * @returns {jsPDF} - The generated PDF document
 */
export default async function generatePaymentReceipt(data) {
  const { payment, invoice, newTotalPaid, newRemainingBalance } = data;

  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Load logo
  let logoDataUrl = null;
  try {
    const blob = await fetch("/logo-kcl.png").then((r) =>
      r.ok ? r.blob() : null
    );
    if (blob) {
      logoDataUrl = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo loading failed:", e);
  }

  // Frame / border
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Header with logo
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, 140, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(COMPANY.cityState, 140, 84);
  doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

  // "PAYMENT RECEIPT" title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PAYMENT RECEIPT", W - 40, 64, { align: "right" });

  // Receipt meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const receiptNum = payment.id ? payment.id.slice(-8).toUpperCase() : "DRAFT";
  doc.text(`Receipt No.: ${receiptNum}`, W - 40, 84, { align: "right" });
  doc.text(`Date: ${moment(payment.paymentDate).format("MMM DD, YYYY")}`, W - 40, 100, {
    align: "right",
  });

  // Divider
  doc.setDrawColor(150);
  doc.line(40, 132, W - 40, 132);

  // Payment details
  let y = 156;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Received From:", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(payment.clientName || "Client Name", 40, y);
  y += 30;

  // Payment amount box (highlighted)
  doc.setFillColor(46, 125, 50); // Green background
  doc.roundedRect(40, y, W - 80, 60, 8, 8, "F");

  doc.setTextColor(255, 255, 255); // White text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Payment Received:", W / 2, y + 20, { align: "center" });
  doc.setFontSize(24);
  doc.text(
    `$${parseFloat(payment.amount).toFixed(2)}`,
    W / 2,
    y + 45,
    { align: "center" }
  );

  doc.setTextColor(0, 0, 0); // Reset to black
  y += 80;

  // Payment details table
  const drawLabelValue = (label, value) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 60, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${value}`, 200, y, { maxWidth: W - 240 });
    y += 20;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment Details", 40, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const paymentMethodLabels = {
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
    credit_card: "Credit Card",
    venmo: "Venmo",
    paypal: "PayPal",
    other: "Other",
  };

  drawLabelValue("Payment Method", paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod);
  
  if (payment.reference) {
    drawLabelValue("Reference", payment.reference);
  }

  if (payment.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 60, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const notesLines = doc.splitTextToSize(payment.notes, W - 120);
    doc.text(notesLines, 60, y);
    y += notesLines.length * 14 + 10;
  }

  y += 10;

  // Invoice summary
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Invoice Summary", 40, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const invoiceTotal = parseFloat(invoice.total || invoice.amount || 0);

  drawLabelValue("Invoice Total", `$${invoiceTotal.toFixed(2)}`);
  drawLabelValue("Total Paid", `$${newTotalPaid.toFixed(2)}`);

  // Balance remaining (highlighted)
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  if (newRemainingBalance <= 0) {
    doc.setTextColor(46, 125, 50); // Green
    doc.text("Balance Remaining:", 60, y);
    doc.setTextColor(46, 125, 50); // Make sure text color is set
    doc.text("$0.00 - PAID IN FULL", 200, y);
  } else {
    doc.setTextColor(211, 47, 47); // Red
    doc.text("Balance Remaining:", 60, y);
    doc.setTextColor(211, 47, 47); // Make sure text color is set
    doc.text("$" + newRemainingBalance.toFixed(2), 200, y);
  }

  doc.setTextColor(0, 0, 0); // Reset to black
  y += 40;

  // Thank you message
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(
    "Thank you for your payment!",
    W / 2,
    y,
    { align: "center" }
  );
  y += 18;
  doc.text(
    "We appreciate your business.",
    W / 2,
    y,
    { align: "center" }
  );

  // Footer
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is an official payment receipt from Kings Canyon Landscaping LLC",
    W / 2,
    H - 50,
    { align: "center" }
  );
  doc.text(
    `Generated: ${moment().format("MMM DD, YYYY [at] h:mm A")}`,
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}