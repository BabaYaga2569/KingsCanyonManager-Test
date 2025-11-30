import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a professional invoice PDF with all details
 * @param {object} invoice - The invoice object from Firestore
 * @returns {jsPDF} - The generated PDF document
 */
export default async function generateInvoicePDF(invoice) {
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Get logo if provided
  const logoDataUrl = invoice.logoDataUrl;

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

  // "INVOICE" title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", W - 40, 64, { align: "right" });

  // Invoice meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const invoiceNum = invoice.id ? invoice.id.slice(-8).toUpperCase() : "DRAFT";
  doc.text(`Invoice No.: ${invoiceNum}`, W - 40, 84, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, W - 40, 100, { align: "right" });

  // Divider
  doc.setDrawColor(150);
  doc.line(40, 132, W - 40, 132);

  // Bill To section
  let y = 156;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Bill To:", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  // Client name
  doc.text(invoice.clientName || "Client Name", 40, y);
  y += 16;

  // Client email (if provided)
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, 40, y);
    y += 16;
  }

  // Client phone (if provided)
  if (invoice.clientPhone) {
    doc.text(invoice.clientPhone, 40, y);
    y += 16;
  }

  // Client address (if provided)
  if (invoice.clientAddress) {
    const addressLines = doc.splitTextToSize(invoice.clientAddress, W - 80);
    doc.text(addressLines, 40, y);
    y += addressLines.length * 14 + 10;
  }

  y += 10;

  // Description section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Description:", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (invoice.description) {
    const descLines = doc.splitTextToSize(invoice.description, W - 80);
    doc.text(descLines, 40, y);
    y += descLines.length * 14 + 10;
  } else {
    doc.text("No description provided", 40, y);
    y += 24;
  }

  // Materials section (if provided)
  if (invoice.materials) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Materials:", 40, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const materialLines = doc.splitTextToSize(invoice.materials, W - 80);
    doc.text(materialLines, 40, y);
    y += materialLines.length * 14 + 10;
  }

  // Pricing table
  y += 20;
  const tableStartY = y;
  
  // Calculate values
  const subtotal = parseFloat(invoice.subtotal || invoice.amount || 0);
  const tax = parseFloat(invoice.tax || 0);
  const total = parseFloat(invoice.total || subtotal + tax);
  const taxRate = invoice.taxRate || 0;

  // Draw pricing box
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  
  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", W - 200, y);
  doc.text(`$${subtotal.toFixed(2)}`, W - 40, y, { align: "right" });
  y += 20;

  // Tax
  const taxLabel = taxRate > 0 ? `Tax (${taxRate}%):` : "Tax:";
  doc.text(taxLabel, W - 200, y);
  doc.text(`$${tax.toFixed(2)}`, W - 40, y, { align: "right" });
  y += 10;

  // Line above total
  doc.line(W - 200, y, W - 40, y);
  y += 16;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", W - 200, y);
  doc.text(`$${total.toFixed(2)}`, W - 40, y, { align: "right" });

  y += 30;

  // Payment Terms section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment Terms", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  // Default payment terms if notes not provided
  const paymentTerms = invoice.notes || 
    "Payment is due within 14 days of invoice date. Please make checks payable to Kings Canyon Landscaping LLC. Thank you for your business!";
  
  const termsLines = doc.splitTextToSize(paymentTerms, W - 80);
  doc.text(termsLines, 40, y);
  y += termsLines.length * 12 + 20;

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Thank you for choosing Kings Canyon Landscaping!",
    W / 2,
    H - 50,
    { align: "center" }
  );
  doc.text(
    "We appreciate your business.",
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}