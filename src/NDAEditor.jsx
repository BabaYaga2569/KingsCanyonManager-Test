import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Box,
  Paper,
  Divider,
} from "@mui/material";
import Swal from "sweetalert2";
import SignatureCanvas from "react-signature-canvas";
import generateNDAPDF from "./pdf/generateNDAPDF";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  state: "Arizona",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
  logoPath: "/logo-kcl.png",
};

export default function NDAEditor() {
  const { crewId } = useParams();
  const navigate = useNavigate();
  
  const [crew, setCrew] = useState(null);
  const [nda, setNda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const workerSigRef = useRef(null);
  const companySigRef = useRef(null);
  
  const [workerSignedAt, setWorkerSignedAt] = useState("");
  const [companySignedAt, setCompanySignedAt] = useState("");
  const [workerSigData, setWorkerSigData] = useState(null);
  const [companySigData, setCompanySigData] = useState(null);

  const [logoDataUrl, setLogoDataUrl] = useState(null);

  useEffect(() => {
    // Preload logo
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
    const fetchData = async () => {
      try {
        // Fetch crew member
        const crewDoc = await getDoc(doc(db, "crews", crewId));
        if (!crewDoc.exists()) {
          Swal.fire("Not found", "Crew member not found.", "error");
          navigate("/crew-manager");
          return;
        }
        setCrew({ id: crewDoc.id, ...crewDoc.data() });

        // Check if NDA already exists
        const ndaQuery = query(
          collection(db, "ndas"),
          where("crewId", "==", crewId)
        );
        const ndaSnapshot = await getDocs(ndaQuery);
        
        if (!ndaSnapshot.empty) {
          const ndaData = ndaSnapshot.docs[0].data();
          setNda({ id: ndaSnapshot.docs[0].id, ...ndaData });
          setWorkerSigData(ndaData.workerSignature);
          setCompanySigData(ndaData.companySignature);
          setWorkerSignedAt(ndaData.workerSignedAt);
          setCompanySignedAt(ndaData.companySignedAt);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        Swal.fire("Error", "Failed to load data.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [crewId, navigate]);

  // Load saved signatures into canvas
  useEffect(() => {
    if (workerSigData && workerSigRef.current) {
      workerSigRef.current.fromDataURL(workerSigData);
    }
  }, [workerSigData]);

  useEffect(() => {
    if (companySigData && companySigRef.current) {
      companySigRef.current.fromDataURL(companySigData);
    }
  }, [companySigData]);

  const clearWorkerSig = () => {
    workerSigRef.current?.clear();
    setWorkerSignedAt("");
    setWorkerSigData(null);
  };

  const clearCompanySig = () => {
    companySigRef.current?.clear();
    setCompanySignedAt("");
    setCompanySigData(null);
  };

  const markWorkerSigned = () => {
    const timestamp = new Date().toLocaleString();
    const sigData = workerSigRef.current?.toDataURL();
    setWorkerSignedAt(timestamp);
    setWorkerSigData(sigData);
  };

  const markCompanySigned = () => {
    const timestamp = new Date().toLocaleString();
    const sigData = companySigRef.current?.toDataURL();
    setCompanySignedAt(timestamp);
    setCompanySigData(sigData);
  };

  const handleSave = async () => {
    if (!workerSigData || !companySigData) {
      Swal.fire("Missing Signatures", "Both signatures are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const ndaData = {
        crewId: crewId,
        crewName: crew.name,
        companyName: COMPANY.name,
        companyOwner: COMPANY.owner,
        state: COMPANY.state,
        workerSignature: workerSigData,
        companySignature: companySigData,
        workerSignedAt: workerSignedAt,
        companySignedAt: companySignedAt,
        createdAt: new Date().toISOString(),
        status: "Active",
      };

      if (nda) {
        // Update existing
        await setDoc(doc(db, "ndas", nda.id), ndaData);
      } else {
        // Create new
        await setDoc(doc(collection(db, "ndas")), ndaData);
      }

      Swal.fire("Saved", "NDA signed and saved successfully.", "success");
    } catch (error) {
      console.error("Error saving NDA:", error);
      Swal.fire("Error", "Failed to save NDA.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!crew || !workerSigData || !companySigData) {
      Swal.fire("Cannot Generate PDF", "Both signatures are required.", "warning");
      return;
    }

    try {
      const pdf = await generateNDAPDF({
        crew,
        company: COMPANY,
        workerSignature: workerSigData,
        companySignature: companySigData,
        workerSignedAt,
        companySignedAt,
        logoDataUrl,
      });

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      Swal.fire({
        icon: "success",
        title: "PDF Generated!",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire("Error", "Failed to generate PDF.", "error");
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading NDA...
        </Typography>
      </Container>
    );
  }

  if (!crew) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Crew member not found.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" gutterBottom>
        Worker Confidentiality & Non-Disclosure Agreement
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        {crew.name} — {crew.role}
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Agreement Summary
        </Typography>
        <Typography variant="body2" paragraph>
          This NDA protects company pricing, bids, customer information, job methods, and all
          confidential business information. The worker agrees not to disclose or use this
          information during and for 3 years after employment.
        </Typography>
        
        <Typography variant="body2" paragraph>
          <strong>Company:</strong> {COMPANY.name}
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>Worker:</strong> {crew.name}
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>Penalty for Breach:</strong> Up to $15,000 per violation plus legal damages
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>Duration:</strong> During employment + 3 years after
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>Governing State:</strong> {COMPANY.state}
        </Typography>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mt: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Worker Signature
          </Typography>
          <SignatureCanvas
            ref={workerSigRef}
            canvasProps={{
              width: 400,
              height: 180,
              style: { border: "1px solid #ccc", borderRadius: 8, width: "100%" },
            }}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button size="small" variant="outlined" onClick={markWorkerSigned}>
              Save Signature
            </Button>
            <Button size="small" variant="text" onClick={clearWorkerSig}>
              Clear
            </Button>
          </Box>
          <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
            {workerSignedAt ? `Signed: ${workerSignedAt}` : "Not yet signed"}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Company Signature (Owner: Darren Bennett)
          </Typography>
          <SignatureCanvas
            ref={companySigRef}
            canvasProps={{
              width: 400,
              height: 180,
              style: { border: "1px solid #ccc", borderRadius: 8, width: "100%" },
            }}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button size="small" variant="outlined" onClick={markCompanySigned}>
              Save Signature
            </Button>
            <Button size="small" variant="text" onClick={clearCompanySig}>
              Clear
            </Button>
          </Box>
          <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
            {companySignedAt ? `Signed: ${companySignedAt}` : "Not yet signed"}
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !workerSigData || !companySigData}
          size="large"
        >
          {saving ? "Saving..." : "Save NDA"}
        </Button>
        <Button
          variant="outlined"
          color="success"
          onClick={handleGeneratePDF}
          disabled={!workerSigData || !companySigData}
          size="large"
        >
          Generate PDF
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={() => navigate("/crew-manager")}
          size="large"
        >
          Back to Crew
        </Button>
      </Box>
    </Container>
  );
}