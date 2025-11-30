import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  MenuItem,
  Paper,
} from "@mui/material";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
  logoPath: "/logo-kcl.png",
};

const ContractEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // signature canvases + timestamps
  const clientSigRef = useRef(null);
  const contractorSigRef = useRef(null);
  const [clientSignedAt, setClientSignedAt] = useState("");
  const [contractorSignedAt, setContractorSignedAt] = useState("");
  const [clientSigData, setClientSigData] = useState(null);
  const [contractorSigData, setContractorSigData] = useState(null);

  // cache the logo as a dataURL for jsPDF
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  useEffect(() => {
    // preload logo
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(c.toDataURL("image/png"));
      } catch (e) {
        setLogoDataUrl(null);
      }
    };
    img.src = COMPANY.logoPath;
  }, []);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const docRef = doc(db, "contracts", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setContract(data);
          // Load saved signatures if they exist
          if (data.clientSignature) {
            setClientSigData(data.clientSignature);
          }
          if (data.contractorSignature) {
            setContractorSigData(data.contractorSignature);
          }
          if (data.clientSignedAt) {
            setClientSignedAt(data.clientSignedAt);
          }
          if (data.contractorSignedAt) {
            setContractorSignedAt(data.contractorSignedAt);
          }
        } else {
          Swal.fire("Not found", "Contract not found.", "error");
        }
      } catch (e) {
        Swal.fire("Error", "Failed to load contract.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchContract();
  }, [id]);

  // Load saved signatures into canvas when they exist
  useEffect(() => {
    if (clientSigData && clientSigRef.current) {
      clientSigRef.current.fromDataURL(clientSigData);
    }
  }, [clientSigData]);

  useEffect(() => {
    if (contractorSigData && contractorSigRef.current) {
      contractorSigRef.current.fromDataURL(contractorSigData);
    }
  }, [contractorSigData]);

  const handleChange = (e) => {
    setContract({ ...contract, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "contracts", id);
      await updateDoc(docRef, {
        ...contract,
        clientSignature: clientSigData,
        contractorSignature: contractorSigData,
        clientSignedAt,
        contractorSignedAt,
      });
      Swal.fire("Saved", "Contract updated successfully.", "success");
    } catch (e) {
      Swal.fire("Error", "Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  const clearClientSig = () => {
    clientSigRef.current?.clear();
    setClientSignedAt("");
    setClientSigData(null);
  };

  const clearContractorSig = () => {
    contractorSigRef.current?.clear();
    setContractorSignedAt("");
    setContractorSigData(null);
  };

  const markClientSigned = () => {
    const timestamp = new Date().toLocaleString();
    const sigData = clientSigRef.current?.toDataURL();
    setClientSignedAt(timestamp);
    setClientSigData(sigData);
  };

  const markContractorSigned = () => {
    const timestamp = new Date().toLocaleString();
    const sigData = contractorSigRef.current?.toDataURL();
    setContractorSignedAt(timestamp);
    setContractorSigData(sigData);
  };

  const getDataUrlIfSigned = (sigData) => {
    if (!sigData) return null;
    return sigData;
  };

  const handleGeneratePDF = async () => {
    if (!contract) return;

    const docPDF = new jsPDF({ unit: "pt", format: "letter" });
    const W = docPDF.internal.pageSize.getWidth();
    const H = docPDF.internal.pageSize.getHeight();

    // Frame / border
    docPDF.setDrawColor(60);
    docPDF.setLineWidth(1);
    docPDF.rect(28, 28, W - 56, H - 56);

    // Header - FIXED LAYOUT
    if (logoDataUrl) {
      docPDF.addImage(logoDataUrl, "PNG", 40, 42, 60, 60);
    }

    // Company info on the left
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(14);
    docPDF.text(COMPANY.name, 110, 50);
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    docPDF.text(COMPANY.cityState, 110, 66);
    docPDF.text(`${COMPANY.phone}`, 110, 80);
    docPDF.text(COMPANY.email, 110, 94);

    // Title on the right - NO OVERLAP
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(14);
    docPDF.text("Service Contract", W - 40, 50, { align: "right" });
    docPDF.text("Agreement", W - 40, 66, { align: "right" });

    // Contract meta on the right
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    docPDF.text(`Contract No.: ${id.slice(-8)}`, W - 40, 84, { align: "right" });
    docPDF.text(`Date: ${new Date().toLocaleDateString()}`, W - 40, 98, { align: "right" });

    // Divider
    docPDF.setDrawColor(150);
    docPDF.line(40, 120, W - 40, 120);

    // Project details
    let y = 140;

    const writeLabelValue = (label, value) => {
      docPDF.setFont("helvetica", "bold");
      docPDF.text(`${label}:`, 40, y);
      docPDF.setFont("helvetica", "normal");
      docPDF.text(`${value || "N/A"}`, 140, y, { maxWidth: W - 180 });
      y += 18;
    };

    writeLabelValue("Client", contract.clientName);
    writeLabelValue("Status", contract.status || "Pending");
    writeLabelValue("Amount", contract.amount ? `$${contract.amount}` : "N/A");

    docPDF.setFont("helvetica", "bold");
    docPDF.text("Description:", 40, y);
    docPDF.setFont("helvetica", "normal");
    const desc = docPDF.splitTextToSize(contract.description || "N/A", W - 180);
    docPDF.text(desc, 140, y);
    y += desc.length * 14 + 10;

    // Legal sections
    y += 10;
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(11);
    docPDF.text("Scope of Work", 40, y);
    y += 14;
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    y = writeParagraph(
      docPDF,
      "Work to be performed is described above. Any changes or additions requested by the client that are not listed will be treated as a change order and may affect price and timeline.",
      40,
      y,
      W - 80
    );
    y += 8;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(11);
    docPDF.text("Payment Terms", 40, y);
    y += 14;
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    y = writeParagraph(
      docPDF,
      "Unless otherwise agreed, payment is due upon substantial completion of the project. Invoices are due within 14 days. A late payment fee of 5% may be applied to balances over 15 days past due.",
      40,
      y,
      W - 80
    );
    y += 8;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(11);
    docPDF.text("Warranty & Liability", 40, y);
    y += 14;
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    y = writeParagraph(
      docPDF,
      "All workmanship is warranted for 30 days from completion against defects in installation. Materials are covered by their manufacturer warranties where applicable. Kings Canyon Landscaping is not responsible for damage caused by misuse, neglect, or acts of nature.",
      40,
      y,
      W - 80
    );
    y += 8;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(11);
    docPDF.text("Cancellation Policy", 40, y);
    y += 14;
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    y = writeParagraph(
      docPDF,
      "Client may cancel before work begins. If materials have been ordered or delivered, a restocking fee of up to 20% and any non-refundable charges will apply. If work has begun, client will be responsible for labor and materials incurred to date.",
      40,
      y,
      W - 80
    );
    y += 16;

    // Signatures
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(11);
    docPDF.text("Authorization & Acceptance", 40, y);
    y += 14;
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    y = writeParagraph(
      docPDF,
      "By signing below, both parties agree to the terms of this agreement. Digital signatures are valid and binding.",
      40,
      y,
      W - 80
    );
    y += 20;

    // signature boxes
    const sigTop = y;
    const sigBoxH = 80;
    const col1X = 40;
    const col2X = W / 2 + 10;
    const boxW = W - 40 - col2X;

    // Draw boxes
    docPDF.setDrawColor(120);
    docPDF.rect(col1X, sigTop, boxW, sigBoxH);
    docPDF.rect(col2X, sigTop, boxW, sigBoxH);

    // Add signature images if present
    const clientSig = getDataUrlIfSigned(clientSigData);
    const contractorSig = getDataUrlIfSigned(contractorSigData);

    if (clientSig) {
      docPDF.addImage(clientSig, "PNG", col1X + 6, sigTop + 6, boxW - 12, sigBoxH - 12);
    }
    if (contractorSig) {
      docPDF.addImage(contractorSig, "PNG", col2X + 6, sigTop + 6, boxW - 12, sigBoxH - 12);
    }

    // labels
    y = sigTop + sigBoxH + 16;
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(10);
    docPDF.text("Client Signature", col1X, y);
    docPDF.text("Contractor Signature", col2X, y);
    y += 12;

    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(9);
    docPDF.text(`Client: ${contract.clientName || "N/A"}`, col1X, y);
    docPDF.text(`Company: ${COMPANY.name}`, col2X, y);
    y += 12;

    docPDF.text(`Signed: ${clientSignedAt || "—"}`, col1X, y);
    docPDF.text(`Signed: ${contractorSignedAt || "—"}`, col2X, y);

    // Footer
    docPDF.setFontSize(9);
    docPDF.setTextColor(100);
    docPDF.text(
      "Thank you for choosing Kings Canyon Landscaping. We appreciate your business.",
      W / 2,
      H - 36,
      { align: "center" }
    );

    // Save PDF
    const filenameSafe = (contract.clientName || "Contract")
      .replace(/[^\w\- ]+/g, "_")
      .replace(/\s+/g, "_");
    const filename = `${filenameSafe}_Contract.pdf`;
    docPDF.save(filename);

    Swal.fire("Saved", "PDF downloaded successfully.", "success");
  };

  // helper to write long paragraphs with natural wrap
  const writeParagraph = (doc, text, x, yStart, maxWidth) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, yStart);
    return yStart + lines.length * 12;
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading contract...
        </Typography>
      </Container>
    );
  }

  if (!contract) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">No contract data available.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" gutterBottom>
        Edit Contract — {contract.clientName || "Unnamed"}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 900 }}>
        <TextField
          label="Client Name"
          name="clientName"
          value={contract.clientName || ""}
          onChange={handleChange}
          fullWidth
        />

        <TextField
          label="Description"
          name="description"
          multiline
          rows={3}
          value={contract.description || ""}
          onChange={handleChange}
          fullWidth
        />

        <TextField
          label="Amount ($)"
          name="amount"
          type="number"
          value={contract.amount || ""}
          onChange={handleChange}
          fullWidth
        />

        <TextField
          select
          label="Status"
          name="status"
          value={contract.status || "Pending"}
          onChange={handleChange}
          fullWidth
        >
          <MenuItem value="Pending">Pending</MenuItem>
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Completed">Completed</MenuItem>
          <MenuItem value="Cancelled">Cancelled</MenuItem>
        </TextField>

        {/* Signature pads */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Client Signature
            </Typography>
            <SignatureCanvas
              ref={clientSigRef}
              canvasProps={{
                width: 400,
                height: 180,
                style: { border: "1px solid #ccc", borderRadius: 8, width: "100%" },
              }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button size="small" variant="outlined" onClick={markClientSigned}>
                Save Timestamp
              </Button>
              <Button size="small" variant="text" onClick={clearClientSig}>
                Clear
              </Button>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
              {clientSignedAt ? `Signed: ${clientSignedAt}` : "Not yet signed"}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Contractor Signature (Kings Canyon Landscaping)
            </Typography>
            <SignatureCanvas
              ref={contractorSigRef}
              canvasProps={{
                width: 400,
                height: 180,
                style: { border: "1px solid #ccc", borderRadius: 8, width: "100%" },
              }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button size="small" variant="outlined" onClick={markContractorSigned}>
                Save Timestamp
              </Button>
              <Button size="small" variant="text" onClick={clearContractorSig}>
                Clear
              </Button>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
              {contractorSignedAt ? `Signed: ${contractorSignedAt}` : "Not yet signed"}
            </Typography>
          </Paper>
        </Box>

        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Contract & Signatures"}
          </Button>
          <Button variant="outlined" color="success" onClick={handleGeneratePDF}>
            Generate & Download PDF
          </Button>
          <Button variant="text" color="inherit" onClick={() => navigate("/contracts")}>
            Back to Contracts
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default ContractEditor;