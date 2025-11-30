import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a payment receipt PDF
 * @param {object} receiptData - Receipt data including invoice and payment info
 * @returns {jsPDF} - The generated PDF document
 */
export default async function generateReceiptPDF(receiptData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const logoDataUrl = receiptData.logoDataUrl;

  // Frame / border
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Header with logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
    } catch (e) {
      console.warn("Logo failed to load:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, 140, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(COMPANY.cityState, 140, 84);
  doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

  // "RECEIPT" title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 128, 0); // Green color for PAID
  doc.text("PAYMENT RECEIPT", W - 40, 64, { align: "right" });
  doc.setTextColor(0, 0, 0); // Back to black

  // Receipt meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const receiptNum = receiptData.id ? receiptData.id.slice(-8).toUpperCase() : "DRAFT";
  doc.text(`Receipt No.: ${receiptNum}`, W - 40, 84, { align: "right" });
  doc.text(`Date: ${receiptData.paidAt || new Date().toLocaleString()}`, W - 40, 100, { align: "right" });

  // Divider
  doc.setDrawColor(150);
  doc.line(40, 132, W - 40, 132);

  // Paid To section
  let y = 156;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Received From:", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // Client name
  doc.text(receiptData.clientName || "Customer", 40, y);
  y += 16;

  // Client email (if provided)
  if (receiptData.clientEmail) {
    doc.text(receiptData.clientEmail, 40, y);
    y += 16;
  }

  // Client phone (if provided)
  if (receiptData.clientPhone) {
    doc.text(receiptData.clientPhone, 40, y);
    y += 16;
  }

  y += 10;

  // Payment details section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment Details:", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  if (receiptData.description) {
    const descLines = doc.splitTextToSize(receiptData.description, W - 80);
    doc.text(descLines, 40, y);
    y += descLines.length * 14 + 10;
  }

  // Payment method and amount box
  y += 10;
  doc.setDrawColor(0, 128, 0);
  doc.setLineWidth(2);
  doc.rect(40, y, W - 80, 60);

  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Payment Method:", 50, y);
  doc.text(receiptData.paymentMethod || "Cash", W - 50, y, { align: "right" });

  y += 25;
  doc.setFontSize(18);
  doc.setTextColor(0, 128, 0);
  doc.text("Amount Paid:", 50, y);
  doc.text(`$${receiptData.paidAmount.toFixed(2)}`, W - 50, y, { align: "right" });
  doc.setTextColor(0, 0, 0);

  y += 40;

  // Payment breakdown (if tax exists)
  if (receiptData.subtotal && receiptData.tax) {
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    doc.text("Subtotal:", W - 200, y);
    doc.text(`$${parseFloat(receiptData.subtotal).toFixed(2)}`, W - 40, y, { align: "right" });
    y += 14;

    const taxRate = receiptData.taxRate || 0;
    const taxLabel = taxRate > 0 ? `Tax (${taxRate}%):` : "Tax:";
    doc.text(taxLabel, W - 200, y);
    doc.text(`$${parseFloat(receiptData.tax).toFixed(2)}`, W - 40, y, { align: "right" });
    y += 10;

    doc.setDrawColor(150);
    doc.line(W - 200, y, W - 40, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total:", W - 200, y);
    doc.text(`$${receiptData.paidAmount.toFixed(2)}`, W - 40, y, { align: "right" });
    y += 20;
  }

  // PAID stamp
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(0, 128, 0);
  doc.text("✓ PAID IN FULL", W / 2, y + 20, { align: "center" });
  doc.setTextColor(0, 0, 0);

  y += 50;

  // Thank you message
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const thankYouMsg = "This receipt confirms that payment has been received in full for the services described above.";
  const thankYouLines = doc.splitTextToSize(thankYouMsg, W - 80);
  doc.text(thankYouLines, W / 2, y, { align: "center" });

  y += thankYouLines.length * 14 + 20;

  // Company signature
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Authorized by:", 40, y);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, 40, y + 14);

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    "Thank you for choosing Kings Canyon Landscaping!",
    W / 2,
    H - 50,
    { align: "center" }
  );
  doc.text(
    "We appreciate your business and look forward to serving you again.",
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}