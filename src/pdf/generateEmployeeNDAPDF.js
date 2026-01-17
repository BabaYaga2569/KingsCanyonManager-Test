import jsPDF from 'jspdf';

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  state: "Arizona",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

/**
 * Generate a signed NDA PDF for an employee
 * @param {Object} employee - Employee data with NDA signature
 * @param {string} logoDataUrl - Base64 logo image (optional)
 * @returns {jsPDF} - PDF document
 */
export default async function generateEmployeeNDAPDF(employee, logoDataUrl = null) {
  const pdf = new jsPDF('p', 'pt', 'letter');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPos = margin;

  // Helper to check if we need a new page
  const checkPageBreak = (neededSpace) => {
    if (yPos + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header with logo
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', margin, yPos, 60, 60);
    } catch (e) {
      console.warn('Logo not loaded:', e);
    }
  }

  // Company name and contact
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(COMPANY.name, pageWidth / 2, yPos + 20, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY.cityState, pageWidth / 2, yPos + 35, { align: 'center' });
  pdf.text(`${COMPANY.phone} | ${COMPANY.email}`, pageWidth / 2, yPos + 48, { align: 'center' });
  
  yPos += 80;

  // Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('NON-DISCLOSURE AGREEMENT', pageWidth / 2, yPos, { align: 'center' });
  yPos += 30;

  // Employee Info Box
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPos, contentWidth, 60, 'F');
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Employee:', margin + 10, yPos + 20);
  pdf.text('Job Title:', margin + 10, yPos + 35);
  pdf.text('Date Signed:', margin + 10, yPos + 50);
  
  pdf.setFont('helvetica', 'normal');
  pdf.text(employee.name || 'N/A', margin + 80, yPos + 20);
  pdf.text(employee.jobTitle || 'N/A', margin + 80, yPos + 35);
  pdf.text(
    employee.ndaSignedDate ? new Date(employee.ndaSignedDate).toLocaleString() : 'N/A',
    margin + 80,
    yPos + 50
  );
  
  yPos += 80;

  // NDA Content
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  const ndaSections = [
    {
      title: '1. Purpose',
      content: 'During the course of employment with the Company, Employee may have access to certain confidential and proprietary information. This Agreement is intended to prevent unauthorized disclosure of such information.'
    },
    {
      title: '2. Confidential Information',
      content: 'Confidential Information includes, but is not limited to: Customer lists, contact information, and project details; Pricing structures, bid strategies, and financial information; Business plans, marketing strategies, and operational procedures; Proprietary designs, landscape plans, and project specifications; Employee information, payroll data, and compensation structures; Vendor relationships, supplier agreements, and trade secrets; Any information marked as "confidential" or that a reasonable person would understand to be confidential.'
    },
    {
      title: '3. Obligations',
      content: 'Employee agrees to: Hold all Confidential Information in strict confidence; Not disclose Confidential Information to any third party without prior written consent; Use Confidential Information solely for performing job duties for the Company; Take reasonable precautions to prevent unauthorized disclosure; Return or destroy all Confidential Information upon termination of employment.'
    },
    {
      title: '4. Exceptions',
      content: 'This Agreement does not apply to information that: Is or becomes publicly available through no fault of Employee; Was rightfully in Employee\'s possession prior to disclosure by Company; Is independently developed by Employee without use of Confidential Information; Must be disclosed pursuant to law, court order, or government regulation (with notice to Company).'
    },
    {
      title: '5. Non-Solicitation',
      content: 'During employment and for a period of 12 months after termination, Employee agrees not to directly solicit Company customers for competing landscaping services.'
    },
    {
      title: '6. Term',
      content: 'This Agreement begins on the date of signature and continues during employment and for a period of 3 years following termination of employment for any reason.'
    },
    {
      title: '7. Remedies',
      content: 'Employee acknowledges that breach of this Agreement may cause irreparable harm to the Company and that monetary damages may be inadequate. Company shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law.'
    },
    {
      title: '8. General Provisions',
      content: 'This Agreement is governed by the laws of Arizona; This Agreement constitutes the entire agreement regarding confidentiality; Any modifications must be in writing and signed by both parties; If any provision is found invalid, the remaining provisions remain in effect.'
    }
  ];

  for (const section of ndaSections) {
    checkPageBreak(80);
    
    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.title, margin, yPos);
    yPos += 15;
    
    // Section content
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(section.content, contentWidth);
    lines.forEach(line => {
      checkPageBreak(15);
      pdf.text(line, margin, yPos);
      yPos += 12;
    });
    
    yPos += 10; // Space between sections
  }

  // Signature Section
  checkPageBreak(120);
  yPos += 20;
  
  pdf.setDrawColor(0, 0, 0);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EMPLOYEE SIGNATURE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;

  // Employee signature
  if (employee.ndaSignatureUrl) {
    try {
      checkPageBreak(100);
      
      // Signature box
      pdf.setDrawColor(21, 101, 192); // Blue border
      pdf.setLineWidth(2);
      pdf.rect(margin, yPos, contentWidth, 80);
      
      // Add signature image
      const img = await loadImage(employee.ndaSignatureUrl);
      const imgWidth = Math.min(contentWidth - 20, 300);
      const imgHeight = 60;
      const imgX = margin + (contentWidth - imgWidth) / 2;
      const imgY = yPos + 10;
      
      pdf.addImage(img, 'PNG', imgX, imgY, imgWidth, imgHeight);
      yPos += 90;
    } catch (error) {
      console.error('Error loading signature:', error);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.text('[Signature image could not be loaded]', margin + 10, yPos + 40);
      yPos += 90;
    }
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.text('[No signature available]', margin + 10, yPos);
    yPos += 30;
  }

  // Signed date
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Electronically signed on ${employee.ndaSignedDate ? new Date(employee.ndaSignedDate).toLocaleDateString() : 'N/A'}`,
    margin,
    yPos
  );
  yPos += 20;

  // Employee name
  pdf.text(`Employee Name: ${employee.name || 'N/A'}`, margin, yPos);
  yPos += 15;
  pdf.text(`Email: ${employee.email || 'N/A'}`, margin, yPos);

  // Footer
  yPos = pageHeight - 30;
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `This is a legally binding electronic signature | ${COMPANY.name}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  return pdf;
}

/**
 * Helper function to load image from URL
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}