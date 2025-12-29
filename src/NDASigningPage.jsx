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

const NDA_TEXT = `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into by and between Kings Canyon Landscaping LLC ("Company") and the undersigned employee/contractor ("Recipient").

1. CONFIDENTIAL INFORMATION
The Recipient acknowledges that during their engagement with the Company, they may have access to confidential and proprietary information including but not limited to:
   • Customer lists, contacts, and information
   • Pricing structures and bid information
   • Business strategies and operations
   • Trade secrets and proprietary methods
   • Financial information
   • Employee information

2. NON-DISCLOSURE OBLIGATIONS
The Recipient agrees to:
   • Keep all confidential information strictly confidential
   • Not disclose any confidential information to third parties
   • Not use confidential information for personal benefit
   • Return all company materials upon termination of employment

3. DURATION
This agreement remains in effect during employment and for a period of two (2) years following termination of employment or engagement with the Company.

4. REMEDIES
The Recipient acknowledges that violation of this agreement may result in immediate termination and legal action for damages.

5. GOVERNING LAW
This agreement shall be governed by the laws of the State of Arizona.

By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.
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
  doc.text("NON-DISCLOSURE AGREEMENT", W / 2, 140, { align: "center" });

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
  doc.setFontSize(10);
  
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
    y += 12;
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
  doc.text("Employee Signature", col1X, y);
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
          <p><strong>Don't forget to download your copy!</strong></p>
        `,
        confirmButtonText: "OK",
      });

      setAlreadySigned(true);
    } catch (error) {
      console.error("Error signing NDA:", error);
      Swal.fire("Error", "Failed to sign NDA. Please try again or contact the company.", "error");
    } finally {
      setSigning(false);
    }
  };

  // Generate Darren's auto-signature
  const generateDarrenSignature = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 100);
    
    ctx.font = '32px "Brush Script MT", cursive';
    ctx.fillStyle = 'black';
    ctx.fillText('Darren Bennett', 50, 60);
    
    return canvas.toDataURL('image/png');
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      // Load logo
      let logoDataUrl = null;
      try {
        const blob = await fetch("/logo-kcl.png").then((r) => (r.ok ? r.blob() : null));
        if (blob) {
          logoDataUrl = await new Promise((res) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Logo failed:", e);
      }

      const pdfDoc = await generateNDAPDF(crewMember, logoDataUrl);
      
      const fileName = `NDA_${(crewMember.name || "Employee").replace(/\s+/g, "_")}_Signed.pdf`;
      pdfDoc.save(fileName);

      Swal.fire({
        icon: "success",
        title: "PDF Downloaded!",
        text: "Check your downloads folder",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      Swal.fire("Error", "Failed to generate PDF. Please try again.", "error");
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 8, textAlign: "center" }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading NDA...
        </Typography>
      </Container>
    );
  }

  if (!crewMember) {
    return (
      <Container sx={{ mt: 8 }}>
        <Alert severity="error">
          <Typography variant="h6">Invalid Link</Typography>
          <Typography>
            This NDA link is invalid or has expired. Please contact Kings Canyon Landscaping at {COMPANY.phone}
          </Typography>
        </Alert>
      </Container>
    );
  }

  if (alreadySigned) {
    return (
      <Container sx={{ mt: 8, maxWidth: "md" }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ color: "success.main" }}>
            NDA Already Signed
          </Typography>
          <Typography variant="h6" gutterBottom>
            {crewMember.name || "Employee"}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Signed:</strong> {crewMember.ndaSignedAt || "Unknown"}
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            <strong>Status:</strong> {crewMember.ndaStatus || "Signed"}
          </Typography>

          {/* Download PDF Button */}
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            sx={{ mb: 2 }}
          >
            {downloadingPDF ? "Generating PDF..." : "Download Signed NDA (PDF)"}
          </Button>

          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Keep a copy for your records. You may close this window after downloading.
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 6, maxWidth: "lg" }}>
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          {COMPANY.name}
        </Typography>
        <Typography variant="h5" gutterBottom>
          Non-Disclosure Agreement
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {COMPANY.phone} • {COMPANY.email}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Employee Info */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Employee Information
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Typography>
            <strong>Name:</strong> {crewMember.name || "N/A"}
          </Typography>
          <Typography>
            <strong>Position:</strong> {crewMember.position || "Crew Member"}
          </Typography>
          <Typography>
            <strong>Phone:</strong> {crewMember.phone || "N/A"}
          </Typography>
          <Typography>
            <strong>Date:</strong> {new Date().toLocaleDateString()}
          </Typography>
        </Box>
      </Paper>

      {/* NDA Text */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, maxHeight: 500, overflowY: "auto" }}>
        <Typography variant="body1" sx={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
          {NDA_TEXT}
        </Typography>
      </Paper>

      {/* Agreement Checkbox */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: "#f5f5f5" }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="body1">
              <strong>I have read and agree to the terms of this Non-Disclosure Agreement</strong>
            </Typography>
          }
        />
      </Paper>

      {/* Signature Pad */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Employee Signature
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign below using your finger or mouse
        </Typography>
        <Box
          sx={{
            border: "2px solid #1565c0",
            borderRadius: 2,
            p: 1,
            bgcolor: "white",
          }}
        >
          <SignatureCanvas
            ref={sigPadRef}
            canvasProps={{
              width: 800,
              height: 200,
              style: {
                width: "100%",
                height: "auto",
                touchAction: "none",
              },
            }}
          />
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => sigPadRef.current?.clear()}
          >
            Clear Signature
          </Button>
        </Box>
      </Paper>

      {/* Sign Button */}
      <Box sx={{ textAlign: "center" }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSign}
          disabled={signing || !agreed}
          sx={{
            py: 2,
            px: 6,
            fontSize: "1.1rem",
            fontWeight: 700,
          }}
        >
          {signing ? "Signing..." : "Sign NDA"}
        </Button>
        {!agreed && (
          <Typography variant="caption" display="block" sx={{ mt: 1, color: "error.main" }}>
            Please check the agreement box to continue
          </Typography>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {COMPANY.name} | {COMPANY.phone} | {COMPANY.email}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Digital signatures are legally binding and valid
        </Typography>
      </Box>
    </Container>
  );
}

// Wrapper to isolate public page from main app
export default function NDASigningPage() {
  return (
    <ThemeProvider theme={publicTheme}>
      <CssBaseline />
      <NDASigningPageContent />
    </ThemeProvider>
  );
}