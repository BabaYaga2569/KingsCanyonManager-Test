import jsPDF from "jspdf";

export default async function generateNDAPDF(data) {
  const { crew, company, workerSignature, companySignature, workerSignedAt, companySignedAt, logoDataUrl } = data;

  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = W - (margin * 2);

  let y = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (needed) => {
    if (y + needed > H - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to write wrapped text
  const writeText = (text, fontSize = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * fontSize * 0.5 + 10);
    doc.text(lines, margin, y);
    y += lines.length * fontSize * 0.5 + 8;
  };

  // Border
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Logo
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, y, 80, 80);
  }

  // Company Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name, margin + 90, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(company.cityState, margin + 90, y + 38);
  doc.text(`${company.phone} • ${company.email}`, margin + 90, y + 52);

  y += 100;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("WORKER CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT (NDA)", W / 2, y, { align: "center" });
  y += 30;

  // Agreement Details
  doc.setFontSize(11);
  doc.text(`Company/Owner: ${company.name}`, margin, y);
  y += 16;
  doc.text(`Worker: ${crew.name}`, margin, y);
  y += 16;
  doc.text(`Effective Date: ${new Date().toLocaleDateString()}`, margin, y);
  y += 25;

  // Divider
  doc.setDrawColor(150);
  doc.line(margin, y, W - margin, y);
  y += 20;

  // Section 1: Purpose
  writeText("1. Purpose", 12, true);
  writeText("The Company provides materials, labor, pricing, bids, customer connections, designs, and work processes that are confidential and valuable. The Worker will have access to this information and agrees to keep it fully confidential.");
  y += 5;

  // Section 2: Confidential Information
  writeText("2. Confidential Information", 12, true);
  writeText('"Confidential Information" includes, but is not limited to:');
  const confItems = [
    "• Company pricing, bids, estimates, profit margins",
    "• Job methods, techniques, materials used, vendor lists",
    "• Customer names, addresses, or job locations",
    "• Any personal information about the Company or the Company's owner",
    "• Contracts, job notes, photos of jobs, messages, or internal communication",
    "• Any information not made public by the Company",
  ];
  confItems.forEach(item => {
    checkPageBreak(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(item, margin + 10, y);
    y += 14;
  });
  y += 5;

  // Section 3: Non-Disclosure
  writeText("3. Non-Disclosure", 12, true);
  writeText("The Worker may NOT share, post, publish, or discuss any Confidential Information with:");
  const nonDiscItems = [
    "• Friends, family, other workers",
    "• Competitors, future employers, or anyone else",
    "• Customers unless specifically instructed by the Company",
  ];
  nonDiscItems.forEach(item => {
    checkPageBreak(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(item, margin + 10, y);
    y += 14;
  });
  writeText("Any disclosure is considered a breach of this Agreement.");
  y += 5;

  // Section 4: Non-Use / Non-Competition
  writeText("4. Non-Use / Non-Competition (Information Only)", 12, true);
  writeText("If the Worker leaves the Company or starts their own business, they:");
  const nonUseItems = [
    "• Cannot use the Company's bids, pricing, job methods, or customer information",
    "• Cannot copy or reproduce the Company's job designs, estimates, or work processes",
    "• Cannot take or use any customer leads, job photos, or job information learned while working for the Company",
  ];
  nonUseItems.forEach(item => {
    checkPageBreak(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(item, margin + 10, y);
    y += 14;
  });
  y += 5;

  // Section 5: Return of Materials
  writeText("5. Return of Materials", 12, true);
  writeText("Upon request or upon termination, the Worker must immediately return: job notes, photos, estimates, materials lists, and any documents or digital information belonging to the Company. No copies may be kept.");
  y += 5;

  // Section 6: Penalties
  writeText("6. Penalties for Breach", 12, true);
  writeText("If the Worker violates any part of this Agreement, the Worker agrees that:");
  const penaltyItems = [
    "• The breach causes serious damage to the Company",
    "• The Worker may be legally liable",
    "• A penalty of up to $15,000 may be imposed for each violation",
    "• Additional damages may be pursued in court if losses exceed that amount",
  ];
  penaltyItems.forEach(item => {
    checkPageBreak(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(item, margin + 10, y);
    y += 14;
  });
  y += 5;

  // Section 7: Duration
  writeText("7. Duration of Agreement", 12, true);
  writeText("This Agreement remains in effect during employment and for 3 years after the Worker leaves the Company.");
  y += 5;

  // Section 8: At-Will Employment
  writeText("8. At-Will Employment", 12, true);
  writeText("This Agreement does not guarantee employment. The Company may terminate the Worker at any time.");
  y += 5;

  // Section 9: Governing Law
  writeText("9. Governing Law", 12, true);
  writeText(`This Agreement is governed by the laws of the state of: ${company.state}`);
  y += 10;

  // Section 10: Signatures
  checkPageBreak(200);
  writeText("10. Signatures", 12, true);
  y += 10;

  // Signature boxes
  const sigBoxH = 80;
  const col1X = margin;
  const col2X = W / 2 + 10;
  const boxW = (W - margin * 2) / 2 - 20;

  // Draw boxes
  doc.setDrawColor(120);
  doc.rect(col1X, y, boxW, sigBoxH);
  doc.rect(col2X, y, boxW, sigBoxH);

  // Add signatures
  if (workerSignature) {
    doc.addImage(workerSignature, "PNG", col1X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }
  if (companySignature) {
    doc.addImage(companySignature, "PNG", col2X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }

  y += sigBoxH + 16;

  // Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Worker Signature", col1X, y);
  doc.text("Company Signature", col2X, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Worker: ${crew.name}`, col1X, y);
  doc.text(`Owner: ${company.owner}`, col2X, y);
  y += 12;

  doc.text(`Signed: ${workerSignedAt || "—"}`, col1X, y);
  doc.text(`Signed: ${companySignedAt || "—"}`, col2X, y);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This document is legally binding. Both parties have read and agree to all terms.",
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}