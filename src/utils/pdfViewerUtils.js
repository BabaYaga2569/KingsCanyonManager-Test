/**
 * Mobile-Friendly PDF Viewer Utility
 * Opens PDFs properly on both mobile and desktop
 */

/**
 * Open PDF in a mobile-friendly way
 * @param {Blob} pdfBlob - The PDF blob to display
 * @param {string} filename - Filename for download
 * @param {string} title - Title to show in viewer
 */
export const openPDFMobileFriendly = (pdfBlob, filename = 'document.pdf', title = 'View PDF') => {
  const pdfUrl = URL.createObjectURL(pdfBlob);

  // Detect if mobile device
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobileDevice) {
    // For mobile: Create custom viewer with download button
    const viewerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #000;
      overflow: hidden;
    }
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: #1976d2;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn {
      background: white;
      color: #1976d2;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin-left: 8px;
      white-space: nowrap;
    }
    .btn:active {
      background: #f0f0f0;
    }
    .btn-download {
      background: #4caf50;
      color: white;
    }
    .btn-download:active {
      background: #45a049;
    }
    iframe {
      position: fixed;
      top: 60px;
      left: 0;
      width: 100%;
      height: calc(100% - 60px);
      border: none;
      background: white;
    }
    @media (max-width: 480px) {
      .header h1 {
        font-size: 16px;
      }
      .btn {
        padding: 8px 14px;
        font-size: 13px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div>
      <a href="${pdfUrl}" download="${filename}" class="btn btn-download">⬇ Download</a>
      <a href="javascript:window.close()" class="btn">✕ Close</a>
    </div>
  </div>
  <iframe src="${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH"></iframe>
  <script>
    // Auto-cleanup blob URL when window closes
    window.addEventListener('beforeunload', function() {
      URL.revokeObjectURL('${pdfUrl}');
    });
  </script>
</body>
</html>`;

    // Create viewer blob
    const viewerBlob = new Blob([viewerHtml], { type: 'text/html' });
    const viewerUrl = URL.createObjectURL(viewerBlob);
    
    // Try to open in new window
    const newWindow = window.open(viewerUrl, '_blank');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Popup blocked - fallback to download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return { success: false, fallbackDownload: true };
    }

    return { success: true, fallbackDownload: false };
  } else {
    // For desktop: Direct PDF view in new tab
    window.open(pdfUrl, '_blank');
    return { success: true, fallbackDownload: false };
  }
};

/**
 * Generate and open invoice PDF (mobile-friendly)
 */
export const viewInvoicePDF = async (invoice, generateInvoicePDF) => {
  try {
    // Load logo
    let logoDataUrl = null;
    try {
      const blob = await fetch('/logo-kcl.png').then((r) => (r.ok ? r.blob() : null));
      if (blob) {
        logoDataUrl = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn('Logo loading failed:', e);
    }

    // Generate PDF
    const pdfDoc = await generateInvoicePDF({
      ...invoice,
      logoDataUrl,
    });

    const pdfBlob = pdfDoc.output('blob');
    const filename = `Invoice_${invoice.clientName || 'Unknown'}.pdf`;
    const title = `Invoice - ${invoice.clientName || 'View'}`;

    return openPDFMobileFriendly(pdfBlob, filename, title);
  } catch (error) {
    console.error('Invoice PDF error:', error);
    throw error;
  }
};

/**
 * Generate and open payment receipt PDF (mobile-friendly)
 */
export const viewPaymentReceiptPDF = async (paymentData, generatePaymentReceipt) => {
  try {
    const receiptDoc = await generatePaymentReceipt(paymentData);
    const receiptBlob = receiptDoc.output('blob');
    const filename = `Receipt_${paymentData.invoice?.clientName || 'Payment'}.pdf`;
    const title = `Receipt - ${paymentData.invoice?.clientName || 'Payment'}`;

    return openPDFMobileFriendly(receiptBlob, filename, title);
  } catch (error) {
    console.error('Receipt PDF error:', error);
    throw error;
  }
};

export default {
  openPDFMobileFriendly,
  viewInvoicePDF,
  viewPaymentReceiptPDF,
};