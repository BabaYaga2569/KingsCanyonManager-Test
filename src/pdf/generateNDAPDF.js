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
  const writeText = (text, fontSize = 10, bold = false, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * fontSize * 0.5 + 10);
    doc.text(lines, margin + indent, y);
    y += lines.length * fontSize * 0.5 + 8;
  };

  // Helper for bullet points
  const writeBullet = (text) => {
    checkPageBreak(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentWidth - 20);
    doc.text(lines, margin + 20, y);
    // Add bullet
    doc.circle(margin + 8, y - 3, 2, 'F');
    y += lines.length * 12 + 3;
  };

  // Helper for divider line
  const addDivider = () => {
    y += 5;
    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 15;
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
  doc.text("WORKER CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT", W / 2, y, { align: "center" });
  y += 20;
  doc.setFontSize(14);
  doc.text("NON-SOLICITATION & NON-COMPETE AGREEMENT", W / 2, y, { align: "center" });
  y += 30;

  // Agreement Details
  doc.setFontSize(11);
  doc.text(`Company/Owner: ${company.name}`, margin, y);
  y += 16;
  doc.text(`Worker/Recipient: ${crew.name}`, margin, y);
  y += 16;
  doc.text(`Effective Date: ${new Date().toLocaleDateString()}`, margin, y);
  y += 20;

  addDivider();

  // ====================
  // SECTION 1: CONFIDENTIAL INFORMATION
  // ====================
  writeText("1. CONFIDENTIAL INFORMATION", 12, true);
  writeText("The Recipient acknowledges that during their employment or engagement, they may have access to confidential and proprietary information, including but not limited to:");
  y += 3;

  writeBullet("Customer lists, past, current, and future customers");
  writeBullet("Customer contact information and job locations");
  writeBullet("Pricing, bids, estimates, and invoices");
  writeBullet("Business strategies, operations, and scheduling");
  writeBullet("Trade secrets and proprietary methods");
  writeBullet("Financial records");
  writeBullet("Employee and subcontractor information");
  
  y += 5;
  writeText("All such information is the exclusive property of the Company.");
  y += 10;

  addDivider();

  // ====================
  // SECTION 2: NON-DISCLOSURE OBLIGATIONS
  // ====================
  writeText("2. NON-DISCLOSURE OBLIGATIONS", 12, true);
  writeText("The Recipient agrees to:");
  y += 3;

  writeBullet("Keep all confidential information strictly confidential");
  writeBullet("Not disclose confidential information to any third party");
  writeBullet("Not use confidential information for personal benefit or outside business");
  writeBullet("Return all Company property, records, accounts, and materials immediately upon termination");
  
  y += 10;

  addDivider();

  // ====================
  // SECTION 3: NON-SOLICITATION OF CUSTOMERS
  // ====================
  writeText("3. NON-SOLICITATION OF CUSTOMERS", 12, true);
  writeText("The Recipient shall not, during employment or at any time thereafter, directly or indirectly:");
  y += 3;

  writeBullet("Contact, solicit, divert, or perform work for any past, current, or future customer of the Company");
  writeBullet("Attempt to take work from the Company's customers for personal gain or another business");
  writeBullet("Circumvent the Company to secure work for themselves, even if the Recipient originally found the job");
  
  y += 5;
  writeText("This applies whether the Recipient is an employee, independent contractor, or otherwise associated with the Company at the time of the conduct.");
  y += 10;

  addDivider();

  // ====================
  // SECTION 4: LIQUIDATED DAMAGES - CUSTOMER POACHING
  // ====================
  writeText("4. LIQUIDATED DAMAGES – CUSTOMER POACHING", 12, true);
  writeText("The Recipient agrees that any violation of Section 3 (Non-Solicitation) shall result in liquidated damages in the amount of $15,000 per violation, which the parties agree is a reasonable estimate of damages and not a penalty. This amount is due immediately upon breach.");
  y += 10;

  addDivider();

  // ====================
  // SECTION 5: UNAUTHORIZED USE OF COMPANY NAME OR ACCOUNTS
  // ====================
  writeText("5. UNAUTHORIZED USE OF COMPANY NAME OR ACCOUNTS", 12, true);
  writeText("If the Recipient is found using:");
  y += 3;

  writeBullet("The Company name");
  writeBullet("Company phone numbers");
  writeBullet("Company email accounts");
  writeBullet("Company branding, licenses, or reputation");
  
  y += 3;
  writeText("to make money for themselves or another party without written authorization, the following shall apply:");
  y += 3;

  writeBullet("Immediate termination of employment");
  writeBullet("A $1,500 liquidated damages fee per occurrence");
  writeBullet("Possible legal action for additional damages");
  
  y += 10;

  addDivider();

  // ====================
  // SECTION 6: DURATION
  // ====================
  writeText("6. DURATION", 12, true);
  writeText("This Agreement remains in effect during employment and for two (2) years following termination, except for Sections 3, 4, and 5, which survive termination indefinitely where allowed by law.");
  y += 10;

  addDivider();

  // ====================
  // SECTION 7: REMEDIES
  // ====================
  writeText("7. REMEDIES", 12, true);
  writeText("The Recipient acknowledges that breach of this Agreement may result in:");
  y += 3;

  writeBullet("Immediate termination");
  writeBullet("Injunctive relief");
  writeBullet("Recovery of damages, liquidated damages, and attorney's fees");
  
  y += 10;

  addDivider();

  // ====================
  // SECTION 8: GOVERNING LAW
  // ====================
  writeText("8. GOVERNING LAW", 12, true);
  writeText(`This Agreement shall be governed by and enforced under the laws of the State of ${company.state || 'Arizona'}.`);
  y += 15;

  addDivider();

  // ====================
  // ACKNOWLEDGMENT & SIGNATURES
  // ====================
  checkPageBreak(250);
  writeText("ACKNOWLEDGMENT & SIGNATURES", 12, true);
  writeText("By signing below, the Recipient acknowledges that they have read, understood, and agree to be legally bound by this Agreement.");
  y += 20;

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
  doc.text("Worker/Recipient Signature", col1X, y);
  doc.text("Company Signature", col2X, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Name: ${crew.name}`, col1X, y);
  doc.text(`Owner: ${company.owner}`, col2X, y);
  y += 12;

  doc.text(`Date: ${workerSignedAt || "—"}`, col1X, y);
  doc.text(`Date: ${companySignedAt || "—"}`, col2X, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This document is legally binding. Both parties have read and agree to all terms and conditions stated herein.",
    W / 2,
    H - 36,
    { align: "center" }
  );

  return doc;
}