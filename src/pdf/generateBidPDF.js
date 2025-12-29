import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a professional bid PDF with automatic page breaks
 * @param {object} bid - The bid object from Firestore
 * @param {string} logoDataUrl - Base64 encoded logo image
 * @returns {jsPDF} - The generated PDF document
 */
export default async function generateBidPDF(bid, logoDataUrl = null) {
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  
  const MARGIN = 40;
  const BOTTOM_MARGIN = 80; // Leave space for footer
  const MAX_Y = H - BOTTOM_MARGIN;
  
  let currentPage = 1;

  // Helper function to check if we need a new page
  const checkPageBreak = (spaceNeeded) => {
    if (y + spaceNeeded > MAX_Y) {
      addFooter();
      doc.addPage();
      currentPage++;
      addHeader();
      y = 150; // Start content after header on new page
      return true;
    }
    return false;
  };

  // Helper function to add header (logo, company info, title)
  const addHeader = () => {
    // Frame / border
    doc.setDrawColor(60);
    doc.setLineWidth(1);
    doc.rect(28, 28, W - 56, H - 56);

    // Logo
    if (logoDataUrl && currentPage === 1) {
      doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
    }

    // Company info
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
  };

  // Helper function to add footer
  const addFooter = () => {
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
    
    // Page number
    doc.setFontSize(9);
    doc.text(`Page ${currentPage}`, W / 2, H - 20, { align: "center" });
  };

  // Start first page
  addHeader();
  let y = 156;

  // Helper to write label-value pairs
  const writeLabelValue = (label, value) => {
    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const textValue = value || "N/A";
    doc.text(`${textValue}`, 140, y, { maxWidth: W - 180 });
    y += 20;
  };

  // Customer and Amount
  writeLabelValue("Customer", bid.customerName);
  writeLabelValue("Estimated Amount", bid.amount ? `$${Number(bid.amount).toFixed(2)}` : "N/A");

  // Description section
  y += 10;
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.text("Scope of Work:", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  
  if (bid.description) {
    const descLines = doc.splitTextToSize(bid.description, W - 80);
    
    // Write description lines with page break checking
    for (let i = 0; i < descLines.length; i++) {
      checkPageBreak(14);
      doc.text(descLines[i], MARGIN, y);
      y += 14;
    }
    y += 10;
  } else {
    doc.text("No description provided", MARGIN, y);
    y += 24;
  }

  // Materials section
  y += 10;
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.text("Materials:", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  
  if (bid.materials) {
    const materialLines = doc.splitTextToSize(bid.materials, W - 80);
    
    // Write material lines with page break checking
    for (let i = 0; i < materialLines.length; i++) {
      checkPageBreak(14);
      doc.text(materialLines[i], MARGIN, y);
      y += 14;
    }
    y += 10;
  } else {
    doc.text("No materials specified", MARGIN, y);
    y += 24;
  }

  // Notes section (if any)
  if (bid.notes) {
    y += 10;
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.text("Additional Notes:", MARGIN, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    
    const notesLines = doc.splitTextToSize(bid.notes, W - 80);
    
    // Write notes lines with page break checking
    for (let i = 0; i < notesLines.length; i++) {
      checkPageBreak(14);
      doc.text(notesLines[i], MARGIN, y);
      y += 14;
    }
    y += 20;
  }

  // Terms & Conditions
  y += 20;
  checkPageBreak(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Terms & Conditions", MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const terms = [
    "This bid is valid for 30 days from the date listed above.",
    "Final pricing may vary based on site conditions and material availability.",
    "A deposit of 50% will be required before work begins.",
    "Payment in full is due upon completion unless other arrangements have been made.",
    "All work will be completed in a professional and timely manner.",
  ];

  // Write each term with page break checking
  terms.forEach((term) => {
    const termLines = doc.splitTextToSize(`• ${term}`, W - 80);
    
    // Check if entire term fits, otherwise break
    const termHeight = termLines.length * 12 + 4;
    checkPageBreak(termHeight);
    
    doc.text(termLines, MARGIN, y);
    y += termLines.length * 12 + 4;
  });

  // Add footer to last page
  addFooter();

  return doc;
}