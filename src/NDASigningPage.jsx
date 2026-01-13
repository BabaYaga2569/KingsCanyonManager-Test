import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  CssBaseline,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import SignatureCanvas from "react-signature-canvas";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import Swal from "sweetalert2";
import jsPDF from "jspdf";

const publicTheme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    success: { main: '#2e7d32' },
  },
});

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
};

// UPDATED COMPREHENSIVE NDA TEXT - 8 SECTIONS
const NDA_TEXT = `
WORKER CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT
NON-SOLICITATION & NON-COMPETE AGREEMENT

This Agreement is entered into by and between Kings Canyon Landscaping LLC ("Company") and the undersigned ("Recipient").

Effective Date: ${new Date().toLocaleDateString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONFIDENTIAL INFORMATION

The Recipient acknowledges that during their employment or engagement, they may have access to confidential and proprietary information, including but not limited to:

- Customer lists, past, current, and future customers
- Customer contact information and job locations
- Pricing, bids, estimates, and invoices
- Business strategies, operations, and scheduling
- Trade secrets and proprietary methods
- Financial records
- Employee and subcontractor information

All such information is the exclusive property of the Company.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. NON-DISCLOSURE OBLIGATIONS

The Recipient agrees to:

- Keep all confidential information strictly confidential
- Not disclose confidential information to any third party
- Not use confidential information for personal benefit or outside business
- Return all Company property, records, accounts, and materials immediately upon termination

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. NON-SOLICITATION OF CUSTOMERS

The Recipient shall not, during employment or at any time thereafter, directly or indirectly:

- Contact, solicit, divert, or perform work for any past, current, or future customer of the Company
- Attempt to take work from the Company's customers for personal gain or another business
- Circumvent the Company to secure work for themselves, even if the Recipient originally found the job

This applies whether the Recipient is an employee, independent contractor, or otherwise associated with the Company at the time of the conduct.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. LIQUIDATED DAMAGES – CUSTOMER POACHING

The Recipient agrees that any violation of Section 3 (Non-Solicitation) shall result in liquidated damages in the amount of $15,000 per violation, which the parties agree is a reasonable estimate of damages and not a penalty. This amount is due immediately upon breach.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. UNAUTHORIZED USE OF COMPANY NAME OR ACCOUNTS

If the Recipient is found using:
- The Company name
- Company phone numbers
- Company email accounts
- Company branding, licenses, or reputation

to make money for themselves or another party without written authorization, the following shall apply:

- Immediate termination of employment
- A $1,500 liquidated damages fee per occurrence
- Possible legal action for additional damages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. DURATION

This Agreement remains in effect during employment and for two (2) years following termination, except for Sections 3, 4, and 5, which survive termination indefinitely where allowed by law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. REMEDIES

The Recipient acknowledges that breach of this Agreement may result in:

- Immediate termination
- Injunctive relief
- Recovery of damages, liquidated damages, and attorney's fees

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. GOVERNING LAW

This Agreement shall be governed by and enforced under the laws of the State of Arizona.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACKNOWLEDGMENT & SIGNATURES

By signing below, the Recipient acknowledges that they have read, understood, and agree to be legally bound by this Agreement.
`;
// Generate PDF of signed NDA
const generateNDAPDF = async (crewMember, logoDataUrl = null) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Header with logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
    } catch (e) {
      console.warn("Logo failed:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, 140, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Bullhead City, AZ", 140, 84);
  doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT", W / 2, 140, { align: "center" });

  // Employee Info Box
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  doc.rect(40, 160, W - 80, 80);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Employee Information:", 50, 180);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${crewMember.name || "N/A"}`, 50, 200);
  doc.text(`Position: ${crewMember.position || "Crew Member"}`, 50, 216);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 350, 200);
  doc.text(`Phone: ${crewMember.phone || "N/A"}`, 350, 216);

  // NDA Text
  let y = 260;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  const lines = doc.splitTextToSize(NDA_TEXT.trim(), W - 80);
  lines.forEach((line) => {
    if (y > H - 280) {
      doc.addPage();
      y = 60;
      doc.setDrawColor(60);
      doc.setLineWidth(1);
      doc.rect(28, 28, W - 56, H - 56);
    }
    doc.text(line, 40, y);
    y += 11;
  });

  // Signatures section
  if (y > H - 260) {
    doc.addPage();
    y = 60;
    doc.setDrawColor(60);
    doc.setLineWidth(1);
    doc.rect(28, 28, W - 56, H - 56);
  }

  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Signatures", 40, y);
  y += 20;

  const sigBoxH = 80;
  const col1X = 40;
  const col2X = W / 2 + 10;
  const boxW = W - 40 - col2X;

  // Draw signature boxes
  doc.setDrawColor(120);
  doc.rect(col1X, y, boxW, sigBoxH);
  doc.rect(col2X, y, boxW, sigBoxH);

  // Add signatures
  if (crewMember.ndaSignature) {
    doc.addImage(crewMember.ndaSignature, "PNG", col1X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }
  if (crewMember.ndaCompanySignature) {
    doc.addImage(crewMember.ndaCompanySignature, "PNG", col2X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }

  y += sigBoxH + 16;

  // Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Employee/Recipient Signature", col1X, y);
  doc.text("Company Representative", col2X, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Name: ${crewMember.name || "N/A"}`, col1X, y);
  doc.text(`Name: ${COMPANY.owner}`, col2X, y);
  y += 12;

  doc.text(`Signed: ${crewMember.ndaSignedAt || "—"}`, col1X, y);
  doc.text(`Signed: ${crewMember.ndaCompanySignedAt || "—"}`, col2X, y);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a legally binding document. Keep a copy for your records.",
    W / 2,
    H - 50,
    { align: "center" }
  );

  return doc;
};

// Generate Darren's signature
const generateDarrenSignature = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  
  ctx.font = "italic 32px 'Brush Script MT', cursive";
  ctx.fillStyle = "#1565c0";
  ctx.fillText("Darren Bennett", 20, 60);
  
  return canvas.toDataURL();
};

function NDASigningPageContent() {
  const { crewId } = useParams();
  const [loading, setLoading] = useState(true);
  const [crewMember, setCrewMember] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  const sigPadRef = useRef(null);

  useEffect(() => {
    const fetchCrewMember = async () => {
      try {
        const docRef = doc(db, "crews", crewId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCrewMember(data);
          
          // Check if already signed
          if (data.ndaSignature && data.ndaSignedAt) {
            setAlreadySigned(true);
          }
        } else {
          Swal.fire("Not Found", "This NDA link is invalid or has expired.", "error");
        }
      } catch (error) {
        console.error("Error loading NDA:", error);
        Swal.fire("Error", "Failed to load NDA. Please contact the company.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchCrewMember();
  }, [crewId]);

  const handleSign = async () => {
    if (!agreed) {
      Swal.fire("Agreement Required", "Please check the box to agree to the NDA terms.", "warning");
      return;
    }

    if (sigPadRef.current?.isEmpty()) {
      Swal.fire("Signature Required", "Please sign in the box above.", "warning");
      return;
    }

    setSigning(true);

    try {
      const signatureData = sigPadRef.current.toDataURL();
      
      // Arizona local time
      const now = new Date();
      const arizonaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Phoenix',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(now);
      
      // Auto-generate Darren's signature
      const darrenSig = generateDarrenSignature();

      await updateDoc(doc(db, "crews", crewId), {
        ndaSignature: signatureData,
        ndaSignedAt: arizonaTime,
        ndaCompanySignature: darrenSig,
        ndaCompanySignedAt: arizonaTime,
        ndaStatus: "Signed",
        lastUpdated: new Date().toISOString(),
      });

      // Update local state
      setCrewMember({
        ...crewMember,
        ndaSignature: signatureData,
        ndaSignedAt: arizonaTime,
        ndaCompanySignature: darrenSig,
        ndaCompanySignedAt: arizonaTime,
        ndaStatus: "Signed",
      });

      Swal.fire({
        icon: "success",
        title: "NDA Signed!",
        html: `
          <p>Thank you for signing the Non-Disclosure Agreement.</p>
          <p>Your signature has been recorded.</p>
          <p>You can now download your copy of the signed NDA.</p>
        `,
      });

      setAlreadySigned(true);
    } catch (error) {
      console.error("Error signing NDA:", error);
      Swal.fire("Error", "Failed to save signature. Please try again.", "error");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = async () => {
    setDownloadingPDF(true);
    try {
      // Load logo
      let logoDataUrl = null;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            logoDataUrl = canvas.toDataURL("image/png");
            resolve();
          };
          img.onerror = reject;
          img.src = "/logo-kcl.png";
        });
      } catch (e) {
        console.warn("Logo loading failed, continuing without it:", e);
      }

      const doc = await generateNDAPDF(crewMember, logoDataUrl);
      doc.save(`NDA-${crewMember.name.replace(/\s+/g, '_')}-${new Date().getTime()}.pdf`);
      
      Swal.fire({
        icon: "success",
        title: "PDF Downloaded!",
        text: "Your signed NDA has been downloaded.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire("Error", "Failed to generate PDF", "error");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading NDA...</Typography>
      </Container>
    );
  }

  if (!crewMember) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">NDA not found or link is invalid.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Paper elevation={3} sx={{ p: 3, mb: 3, textAlign: "center", bgcolor: "#1565c0", color: "white" }}>
        <Typography variant="h4" gutterBottom>
          {COMPANY.name}
        </Typography>
        <Typography variant="subtitle1">
          Non-Disclosure Agreement
        </Typography>
      </Paper>

      {/* Already Signed */}
      {alreadySigned && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ✅ NDA Already Signed
          </Typography>
          <Typography variant="body2" gutterBottom>
            You signed this NDA on {crewMember.ndaSignedAt}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={downloadingPDF}
            sx={{ mt: 2 }}
          >
            {downloadingPDF ? "Generating PDF..." : "Download Signed NDA"}
          </Button>
        </Alert>
      )}

      {/* NDA Content */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {NDA_TEXT}
        </Typography>
      </Paper>

      {/* Signing Section */}
      {!alreadySigned && (
        <>
          {/* Checkbox Agreement */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  color="primary"
                />
              }
              label="I have read and agree to the terms of this Non-Disclosure Agreement"
            />
          </Paper>

          {/* Signature Pad */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Signature
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Please sign below using your mouse or touch screen
            </Typography>
            <Box
              sx={{
                border: "2px solid #ccc",
                borderRadius: 1,
                mt: 2,
                backgroundColor: "#fafafa",
              }}
            >
              <SignatureCanvas
                ref={sigPadRef}
                canvasProps={{
                  width: 600,
                  height: 200,
                  style: { width: "100%", height: "200px" },
                }}
                backgroundColor="#fafafa"
              />
            </Box>
            <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
              <Button variant="outlined" onClick={clearSignature}>
                Clear Signature
              </Button>
            </Box>
          </Paper>

          {/* Submit Button */}
          <Button
            variant="contained"
            color="success"
            size="large"
            fullWidth
            onClick={handleSign}
            disabled={!agreed || signing}
            sx={{ py: 2 }}
          >
            {signing ? <CircularProgress size={24} /> : "Sign and Submit NDA"}
          </Button>
        </>
      )}

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          {COMPANY.name} • {COMPANY.phone} • {COMPANY.email}
        </Typography>
      </Box>
    </Container>
  );
}

export default function NDASigningPage() {
  return (
    <ThemeProvider theme={publicTheme}>
      <CssBaseline />
      <NDASigningPageContent />
    </ThemeProvider>
  );
}