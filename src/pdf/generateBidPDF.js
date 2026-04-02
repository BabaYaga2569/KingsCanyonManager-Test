import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
};

/**
 * Detect image type from a data URL for jsPDF
 */
function getImageTypeFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image/svg+xml")) return "SVG";
  return null;
}

/**
 * Fetch a remote image URL and convert it to a base64 data URL.
 * Returns null on failure so callers can skip gracefully.
 */
async function fetchImageAsDataUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("fetchImageAsDataUrl failed:", e);
    return null;
  }
}

/**
 * Safely add a signature image to the PDF.
 * Handles PNG/JPEG/WEBP and skips unsupported/invalid formats gracefully.
 */
function addSignatureImage(doc, dataUrl, x, y, w, h, label) {
  if (!dataUrl) return;

  try {
    const imageType = getImageTypeFromDataUrl(dataUrl);

    if (!imageType) {
      console.warn(`Unknown ${label} signature image format`);
      return;
    }

    if (imageType === "SVG") {
      try {
        doc.addImage(dataUrl, "SVG", x, y, w, h);
        return;
      } catch (svgErr) {
        console.warn(`SVG ${label} signature could not be rendered by jsPDF, using text fallback:`, svgErr);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("Darren Bennett", x + 10, y + h / 2);
        return;
      }
    }

    doc.addImage(dataUrl, imageType, x, y, w, h);
  } catch (e) {
    console.error(`Error adding ${label} signature:`, e);
  }
}

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
  const BOTTOM_MARGIN = 80;
  const MAX_Y = H - BOTTOM_MARGIN;

  let currentPage = 1;

  const checkPageBreak = (spaceNeeded) => {
    if (y + spaceNeeded > MAX_Y) {
      addFooter();
      doc.addPage();
      currentPage++;
      addHeader();
      y = 150;
      return true;
    }
    return false;
  };

  const addHeader = () => {
    doc.setDrawColor(60);
    doc.setLineWidth(1);
    doc.rect(28, 28, W - 56, H - 56);

    if (logoDataUrl && currentPage === 1) {
      try {
        doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
      } catch (e) {
        console.error("Error adding logo:", e);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(COMPANY.name, 140, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`${COMPANY.cityState}`, 140, 84);
    doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BID PROPOSAL", W - 40, 64, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const bidNumber = bid.id ? bid.id.slice(-8).toUpperCase() : "DRAFT";
    doc.text(`Bid No.: ${bidNumber}`, W - 40, 84, { align: "right" });

    const bidDate = bid.createdAt
      ? new Date(bid.createdAt).toLocaleDateString()
      : new Date().toLocaleDateString();
    doc.text(`Date: ${bidDate}`, W - 40, 100, { align: "right" });

    doc.setDrawColor(150);
    doc.line(40, 132, W - 40, 132);
  };

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
    doc.text("We look forward to serving you.", W / 2, H - 36, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Page ${currentPage}`, W / 2, H - 20, { align: "center" });
  };

  // ── Start first page ──────────────────────────────────────
  addHeader();
  let y = 156;

  const writeLabelValue = (label, value) => {
    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${value || "N/A"}`, 140, y, { maxWidth: W - 180 });
    y += 20;
  };

  writeLabelValue("Customer", bid.customerName);
  writeLabelValue("Estimated Amount (Labor)", bid.amount ? `$${Number(bid.amount).toFixed(2)}` : "N/A");

  // ── Scope of Work ─────────────────────────────────────────
  y += 10;
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Scope of Work:", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");

  if (bid.description) {
    const descLines = doc.splitTextToSize(bid.description, W - 80);
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

  // ── Materials ─────────────────────────────────────────────
  y += 10;
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.text("Materials (Estimate — Billed Separately at Actual Cost):", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");

  if (bid.materials) {
    const materialLines = doc.splitTextToSize(bid.materials, W - 80);
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

  // ── Additional Notes ──────────────────────────────────────
  if (bid.notes) {
    y += 10;
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.text("Additional Notes:", MARGIN, y);
    y += 14;
    doc.setFont("helvetica", "normal");

    const notesLines = doc.splitTextToSize(bid.notes, W - 80);
    for (let i = 0; i < notesLines.length; i++) {
      checkPageBreak(14);
      doc.text(notesLines[i], MARGIN, y);
      y += 14;
    }
    y += 20;
  }

  // ── AI Concept Rendering ──────────────────────────────────
  if (bid.hasAiConceptRenderingImage && bid.aiConceptRenderingImageUrl) {
    const hasSourcePhoto = !!bid.aiConceptRenderingSourcePhotoUrl;

    // Fetch the rendering image (and source photo if present)
    const renderingDataUrl = await fetchImageAsDataUrl(bid.aiConceptRenderingImageUrl);
    const sourcePhotoDataUrl = hasSourcePhoto
      ? await fetchImageAsDataUrl(bid.aiConceptRenderingSourcePhotoUrl)
      : null;

    if (renderingDataUrl) {
      const renderingImgType = getImageTypeFromDataUrl(renderingDataUrl) || "PNG";

      if (hasSourcePhoto && sourcePhotoDataUrl) {
        // ── Side-by-side: Before / After ─────────────────────
        // Space: 30 header + 8 spacing + 174 images + 20 caption = ~232
        checkPageBreak(240);

        // Section header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("AI Concept Rendering — Before & After", MARGIN, y);
        y += 8;

        // Accent line
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(1.5);
        doc.line(MARGIN, y, MARGIN + 260, y);
        doc.setDrawColor(150);
        doc.setLineWidth(1);
        y += 10;

        // Column layout: two equal columns with a 10pt gap
        const colGap = 10;
        const colW = (W - MARGIN * 2 - colGap) / 2;
        // Images are 1536×1024 (3:2). At colW wide: height = colW * (1024/1536) = colW * 0.667
        const imgH = Math.round(colW * (1024 / 1536));

        const col1X = MARGIN;
        const col2X = MARGIN + colW + colGap;

        // Column labels
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("ORIGINAL SITE PHOTO", col1X, y);
        doc.text("AI CONCEPT RENDERING", col2X, y);
        y += 8;

        // Source photo (left)
        const srcImgType = getImageTypeFromDataUrl(sourcePhotoDataUrl) || "JPEG";
        try {
          doc.addImage(sourcePhotoDataUrl, srcImgType, col1X, y, colW, imgH);
        } catch (e) {
          console.warn("Could not add source photo to PDF:", e);
        }

        // Rendering (right)
        try {
          doc.addImage(renderingDataUrl, renderingImgType, col2X, y, colW, imgH);
        } catch (e) {
          console.warn("Could not add rendering image to PDF:", e);
        }

        y += imgH + 10;

        // Caption row
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100);
        const styleLabel = bid.aiConceptRenderingStyle
          ? `${bid.aiConceptRenderingStyle} — AI-generated landscape concept`
          : "AI-generated landscape concept";
        doc.text(styleLabel, col1X, y);
        y += 20;

      } else {
        // ── Full-width rendering only ─────────────────────────
        // Images are 1536×1024. At full content width (532pt): height = 532 * 0.667 ≈ 355pt
        // That's large — cap at 300pt and let jsPDF letterbox it
        const imgW = W - MARGIN * 2;
        const imgH = Math.min(Math.round(imgW * (1024 / 1536)), 300);

        // Space: 30 header + 18 spacing + imgH + 20 caption
        checkPageBreak(imgH + 68);

        // Section header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("AI Concept Rendering", MARGIN, y);
        y += 8;

        // Accent line
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(1.5);
        doc.line(MARGIN, y, MARGIN + 180, y);
        doc.setDrawColor(150);
        doc.setLineWidth(1);
        y += 10;

        // Rendering image
        try {
          doc.addImage(renderingDataUrl, renderingImgType, MARGIN, y, imgW, imgH);
        } catch (e) {
          console.warn("Could not add rendering image to PDF:", e);
        }

        y += imgH + 10;

        // Caption
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100);
        const styleLabel = bid.aiConceptRenderingStyle
          ? `${bid.aiConceptRenderingStyle} — AI-generated landscape concept`
          : "AI-generated landscape concept";
        doc.text(styleLabel, MARGIN, y);
        y += 20;
      }

      // Reset text color after image section
      doc.setTextColor(0);
    }
  }

  // ── Site Photos ───────────────────────────────────────────
  const sitePhotos = Array.isArray(bid.photos) ? bid.photos.filter(Boolean) : [];

  if (sitePhotos.length > 0) {
    // Fetch all photos (cap at 6 so PDF doesn't get huge)
    const photosToShow = sitePhotos.slice(0, 6);
    const photoDataUrls = await Promise.all(photosToShow.map(url => fetchImageAsDataUrl(url)));
    const validPhotos = photoDataUrls.filter(Boolean);

    if (validPhotos.length > 0) {
      y += 10;
      checkPageBreak(50);

      // Section header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Site Photos", MARGIN, y);
      y += 8;

      // Accent line
      doc.setDrawColor(33, 150, 243);
      doc.setLineWidth(1.5);
      doc.line(MARGIN, y, MARGIN + 100, y);
      doc.setDrawColor(150);
      doc.setLineWidth(1);
      y += 12;

      // 2-column grid layout
      const colGap = 12;
      const colW = (W - MARGIN * 2 - colGap) / 2;
      const photoH = Math.round(colW * (3 / 4)); // 4:3 aspect ratio

      for (let i = 0; i < validPhotos.length; i += 2) {
        // Each row needs photoH + 8pt caption gap
        checkPageBreak(photoH + 20);

        const col1X = MARGIN;
        const col2X = MARGIN + colW + colGap;

        // Left photo
        const imgType1 = getImageTypeFromDataUrl(validPhotos[i]) || "JPEG";
        try {
          doc.addImage(validPhotos[i], imgType1, col1X, y, colW, photoH);
        } catch (e) {
          console.warn("Could not add site photo to PDF:", e);
        }

        // Right photo (if exists)
        if (validPhotos[i + 1]) {
          const imgType2 = getImageTypeFromDataUrl(validPhotos[i + 1]) || "JPEG";
          try {
            doc.addImage(validPhotos[i + 1], imgType2, col2X, y, colW, photoH);
          } catch (e) {
            console.warn("Could not add site photo to PDF:", e);
          }
        }

        y += photoH + 8;

        // Captions
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(`Photo ${i + 1}`, col1X, y);
        if (validPhotos[i + 1]) doc.text(`Photo ${i + 2}`, col2X, y);
        y += 12;
      }

      doc.setTextColor(0);
      y += 10;
    }
  }

  // ── Terms & Conditions ────────────────────────────────────
  y += 20;
  checkPageBreak(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
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
    "Materials Cost: This bid covers labor only. All materials required for this project will be purchased by Kings Canyon Landscaping LLC and billed to the client at actual cost, separate from and in addition to the labor price above. A materials estimate is provided for reference; final materials cost will reflect actual purchase receipts.",
  ];

  terms.forEach((term) => {
    const termLines = doc.splitTextToSize(`• ${term}`, W - 80);
    const termHeight = termLines.length * 12 + 4;
    checkPageBreak(termHeight);
    doc.text(termLines, MARGIN, y);
    y += termLines.length * 12 + 4;
  });

  // ── Signatures ────────────────────────────────────────────
  y += 30;
  checkPageBreak(180);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Authorization & Acceptance", MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const acceptanceText = doc.splitTextToSize(
    "By signing below, both parties agree to the terms outlined in this bid proposal. Digital signatures are valid and binding.",
    W - 80
  );
  doc.text(acceptanceText, MARGIN, y);
  y += acceptanceText.length * 12 + 20;

  checkPageBreak(140);

  const sigBoxH = 80;
  const sigBoxW = (W - 100) / 2;
  const col1X = MARGIN;
  const col2X = W / 2 + 10;

  doc.setDrawColor(120);
  doc.setLineWidth(1);
  doc.rect(col1X, y, sigBoxW, sigBoxH);
  doc.rect(col2X, y, sigBoxW, sigBoxH);

  addSignatureImage(doc, bid.clientSignature, col1X + 6, y + 6, sigBoxW - 12, sigBoxH - 12, "client");
  addSignatureImage(doc, bid.contractorSignature, col2X + 6, y + 6, sigBoxW - 12, sigBoxH - 12, "contractor");

  y += sigBoxH + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Customer Signature", col1X, y);
  doc.text("Contractor Signature", col2X, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Customer: ${bid.customerName || "N/A"}`, col1X, y);
  doc.text(`Company: ${COMPANY.name}`, col2X, y);
  y += 12;

  const clientSignedText = bid.clientSignedAt
    ? `Signed: ${new Date(bid.clientSignedAt).toLocaleDateString()}`
    : "Date: _______________";
  const contractorSignedText = bid.contractorSignedAt
    ? `Signed: ${new Date(bid.contractorSignedAt).toLocaleDateString()}`
    : "Date: _______________";

  doc.text(clientSignedText, col1X, y);
  doc.text(contractorSignedText, col2X, y);

  y += 20;

  addFooter();

  return doc;
}