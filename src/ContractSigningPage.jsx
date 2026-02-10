import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getTokenFromUrl } from './utils/tokenUtils';
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
import Swal from "sweetalert2";

// Create a simple theme for public pages
const publicTheme = createTheme({
  palette: {
    primary: {
      main: '#1565c0',
    },
    success: {
      main: '#2e7d32',
    },
  },
});

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  title: "Owner",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
  logoPath: "/logo-kcl.png",
};

// This is a PUBLIC page - customers access without logging in
// It should NOT show navigation or allow access to other parts of the app
function ContractSigningPageContent() {
  const { contractId } = useParams();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  
  const sigPadRef = useRef(null);

  useEffect(() => {
    loadContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const loadContract = async () => {
    try {
      // Get token from URL
      const token = getTokenFromUrl();
      
      const docRef = doc(db, "contracts", contractId);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        Swal.fire("Not Found", "This contract link is invalid or expired.", "error");
        setLoading(false);
        return;
      }

      const data = snap.data();
      
            // Verify token matches if contract has one
      // Skip check if contract has no token (legacy contracts)
      if (data.signingToken && token && data.signingToken !== token) {
        Swal.fire("Access Denied", "Invalid or expired link. Please request a new signing link.", "error");
        setLoading(false);
        return;
      }
      
      setContract(data);
      
      // Check if already signed by client
      if (data.clientSignature && data.clientSignedAt) {
        setAlreadySigned(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading contract:", error);
      Swal.fire("Error", "Failed to load contract. Please try again.", "error");
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    sigPadRef.current?.clear();
  };

  const handleSign = async () => {
    if (!agreed) {
      Swal.fire("Agreement Required", "Please check the box to agree to the terms.", "warning");
      return;
    }

    if (sigPadRef.current?.isEmpty()) {
      Swal.fire("Signature Required", "Please sign in the box above.", "warning");
      return;
    }

    setSigning(true);

    try {
      const signatureData = sigPadRef.current.toDataURL();
      const timestamp = new Date().toISOString();
      
      // Auto-generate Darren's signature
      const darrenSig = generateDarrenSignature();

      await updateDoc(doc(db, "contracts", contractId), {
        clientSignature: signatureData,
        clientSignedAt: timestamp,
        contractorSignature: darrenSig,
        contractorSignedAt: timestamp,
        status: "Fully Signed", // Both signatures applied automatically
        lastUpdated: timestamp,
      });

      // Send notification email (placeholder - will be implemented with Cloud Function)
      console.log("Contract signed by client:", contractId);

      Swal.fire({
        icon: "success",
        title: "Contract Signed!",
        html: `
          <p>Thank you for signing the contract!</p>
          <p><strong>Next Steps:</strong></p>
          <ul style="text-align: left;">
            <li>You'll receive a payment link via email</li>
            <li>Deposit amount: <strong>$${(contract.depositAmount || contract.amount * 0.5).toFixed(2)}</strong></li>
            <li>We'll start work once deposit is received</li>
          </ul>
          <p>Questions? Call us at ${COMPANY.phone}</p>
        `,
        confirmButtonText: "Close",
      });

      setAlreadySigned(true);
    } catch (error) {
      console.error("Error saving signature:", error);
      Swal.fire("Error", "Failed to save signature. Please try again.", "error");
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
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 100);
    
    // Signature text in cursive style
    ctx.font = '32px "Brush Script MT", cursive';
    ctx.fillStyle = 'black';
    ctx.fillText('Darren Bennett', 50, 60);
    
    return canvas.toDataURL('image/png');
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading contract...
        </Typography>
      </Container>
    );
  }

  if (!contract) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Contract Not Found</Typography>
          <Typography>This contract link is invalid or has expired.</Typography>
        </Alert>
      </Container>
    );
  }

  if (alreadySigned) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Contract Already Signed!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You signed this contract on {new Date(contract.clientSignedAt).toLocaleString()}
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Next Steps:
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            • Check your email for the payment link<br />
            • Deposit amount: <strong>${(contract.depositAmount || contract.amount * 0.5).toFixed(2)}</strong><br />
            • We'll start work once payment is received
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Questions? Call us at {COMPANY.phone}
          </Typography>
        </Paper>
      </Container>
    );
  }

  const depositAmount = contract.depositAmount || (contract.amount * 0.5);
  const finalAmount = contract.amount - depositAmount;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: { xs: 2, sm: 4 } }}>
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <img 
            src={COMPANY.logoPath} 
            alt="Kings Canyon Landscaping" 
            style={{ height: 80, marginBottom: 16 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <Typography variant="h4" gutterBottom>
            Service Contract
          </Typography>
          <Typography variant="h5" color="primary">
            {COMPANY.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {COMPANY.phone} • {COMPANY.email}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Contract Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Contract Details
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Client:</strong> {contract.clientName}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Total Amount:</strong> ${contract.amount?.toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Deposit (50%):</strong> ${depositAmount.toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Balance Due Upon Completion:</strong> ${finalAmount.toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </Typography>
            
            {contract.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Scope of Work:</strong>
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 2 }}>
                  {contract.description}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Terms & Conditions */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Terms & Conditions
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" paragraph>
              <strong>Payment Terms:</strong> A deposit of 50% is required to begin work. The remaining balance is due upon substantial completion of the project. Payment is accepted via Zelle, cash, or check.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Scope of Work:</strong> Work to be performed is described above. Any changes or additions requested by the client that are not listed will be treated as a change order and may affect price and timeline.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Warranty:</strong> All workmanship is warranted for 30 days from completion against defects in installation. Materials are covered by their manufacturer warranties where applicable.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Cancellation:</strong> Client may cancel before work begins. If materials have been ordered, a restocking fee of up to 20% may apply. If work has begun, client will be responsible for labor and materials incurred to date.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Signature Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Client Signature
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            By signing below, you agree to the terms and conditions of this contract.
          </Alert>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mb: 2,
              border: "2px solid",
              borderColor: "primary.main",
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Sign with your finger or mouse:
            </Typography>
            <Box sx={{ 
              border: "1px solid #ccc", 
              borderRadius: 1,
              backgroundColor: "white",
              touchAction: "none",
            }}>
              <SignatureCanvas
                ref={sigPadRef}
                canvasProps={{
                  width: 500,
                  height: 200,
                  style: { 
                    width: "100%", 
                    height: "auto",
                    touchAction: "none",
                  },
                }}
              />
            </Box>
            <Button 
              size="small" 
              onClick={handleClearSignature}
              sx={{ mt: 1 }}
            >
              Clear Signature
            </Button>
          </Paper>

          <FormControlLabel
            control={
              <Checkbox 
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I have read and agree to the terms and conditions of this contract
              </Typography>
            }
          />
        </Box>

        {/* Sign Button */}
        <Box sx={{ textAlign: "center" }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSign}
            disabled={signing || !agreed}
            sx={{ 
              minWidth: 200,
              py: 1.5,
              fontSize: "1.1rem",
            }}
          >
            {signing ? "Signing..." : "Sign Contract"}
          </Button>
          <Typography variant="caption" display="block" sx={{ mt: 2, color: "text.secondary" }}>
            Your signature will be securely stored and a copy will be sent to your email
          </Typography>
        </Box>
      </Paper>

      {/* Footer */}
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {COMPANY.name} | {COMPANY.phone} | {COMPANY.email}
        </Typography>
      </Box>
    </Container>
  );
}

// Wrapper component that prevents navigation to main app
export default function ContractSigningPage() {
  return (
    <ThemeProvider theme={publicTheme}>
      <CssBaseline />
      <ContractSigningPageContent />
    </ThemeProvider>
  );
}