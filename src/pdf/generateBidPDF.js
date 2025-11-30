import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a professional bid PDF
 * @param {object} bid - The bid object from Firestore
 * @param {string} logoDataUrl - Base64 encoded logo image
 * @returns {jsPDF} - The generated PDF document
 */
export default async function generateBidPDF(bid, logoDataUrl = null) {
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

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
  doc.text(`${COMPANY.cityState}`, 140, 84);
  doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

  // "BID PROPOSAL" title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BID PROPOSAL", W - 40, 64, { align: "right" });

  // Bid meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Bid No.: ${bid.id.slice(-8).toUpperCase()}`, W - 40, 84, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, W - 40, 100, { align: "right" });

  // Divider
  doc.setDrawColor(150);
  doc.line(40, 132, W - 40, 132);

  // Bid details
  let y = 156;

  const writeLabelValue = (label, value) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 40, y);
    doc.setFont("helvetica", "normal");
    const textValue = value || "N/A";
    doc.text(`${textValue}`, 140, y, { maxWidth: W - 180 });
    y += 20;
  };

  writeLabelValue("Customer", bid.customerName);
  writeLabelValue("Estimated Amount", bid.amount ? `$${Number(bid.amount).toFixed(2)}` : "N/A");

  // Description section
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Scope of Work:", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  if (bid.description) {
    const descLines = doc.splitTextToSize(bid.description, W - 80);
    doc.text(descLines, 40, y);
    y += descLines.length * 14 + 10;
  } else {
    doc.text("No description provided", 40, y);
    y += 24;
  }

  // Materials section
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Materials:", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  if (bid.materials) {
    const materialLines = doc.splitTextToSize(bid.materials, W - 80);
    doc.text(materialLines, 40, y);
    y += materialLines.length * 14 + 10;
  } else {
    doc.text("No materials specified", 40, y);
    y += 24;
  }

  // Notes section (if any)
  if (bid.notes) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Additional Notes:", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const notesLines = doc.splitTextToSize(bid.notes, W - 80);
    doc.text(notesLines, 40, y);
    y += notesLines.length * 14 + 20;
  }

  // Terms & Conditions
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Terms & Conditions", 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const terms = [
    "This bid is valid for 30 days from the date listed above.",
    "Final pricing may vary based on site conditions and material availability.",
    "A deposit of 25% may be required before work begins.",
    "Payment in full is due upon completion unless other arrangements have been made.",
    "All work will be completed in a professional and timely manner.",
  ];

  terms.forEach((term) => {
    const termLines = doc.splitTextToSize(`• ${term}`, W - 80);
    doc.text(termLines, 40, y);
    y += termLines.length * 12 + 4;
  });

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Thank you for considering Kings Canyon Landscaping for your project!",
    W / 2,
    H - 50,
    { align: "center" }
  );
  doc.text(
    "We look forward to serving you.",
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}