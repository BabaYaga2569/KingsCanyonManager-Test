import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CardActions,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from "@mui/material";
import Swal from "sweetalert2";
import generateContractPDF from "./pdf/generateContractPDF";
import { useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import EmailIcon from "@mui/icons-material/Email";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

const logo = "/logo-kcl.png";
const COMPANY_PHONE = "(928) 450-5733";

export default function ContractsDashboard() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [signingMode, setSigningMode] = useState("remote"); // "remote" or "in-person"
  const [customerEmail, setCustomerEmail] = useState("");
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchContracts = async () => {
    try {
      const snap = await getDocs(collection(db, "contracts"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setContracts(data);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      Swal.fire("Error", "Failed to load contracts.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleDeleteContract = async (id, clientName) => {
    const confirm = await Swal.fire({
      title: "Delete Contract?",
      text: `Are you sure you want to delete ${clientName}'s contract?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "contracts", id));
      setContracts((prev) => prev.filter((c) => c.id !== id));
      Swal.fire("Deleted!", "The contract has been removed.", "success");
    } catch (error) {
      Swal.fire("Error", "Failed to delete contract.", "error");
    }
  };

  const handleStatusChange = async (contract, newStatus) => {
    try {
      await updateDoc(doc(db, "contracts", contract.id), { status: newStatus });
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contract.id ? { ...c, status: newStatus } : c
        )
      );
      Swal.fire("Updated", "Contract status changed successfully.", "success");
    } catch (error) {
      Swal.fire("Error", "Failed to update status.", "error");
    }
  };

  const handleGeneratePDF = async (contract) => {
    try {
      const img = new Image();
      img.src = logo;
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const logoDataUrl = canvas.toDataURL("image/png");

        const pdf = await generateContractPDF(contract, logoDataUrl);
        
        const pdfBlob = pdf.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, "_blank");
      };
    } catch (error) {
      console.error("PDF Generation Error:", error);
      Swal.fire("Error", "Failed to generate PDF.", "error");
    }
  };

  const handleViewEdit = (id) => {
    navigate(`/contract/${id}`);
  };

  const handleOpenSendDialog = (contract) => {
    setSelectedContract(contract);
    setCustomerEmail(contract.clientEmail || "");
    setSendDialogOpen(true);
  };

  // Schedule job handler
  const handleScheduleJob = (contract) => {
    navigate("/schedule-job", { state: { contract } });
  };

  const handleSendForSignature = async () => {
    if (signingMode === "remote" && !customerEmail) {
      Swal.fire("Email Required", "Please enter customer's email address.", "warning");
      return;
    }

    try {
      // IMPORTANT: Use /public/ prefix so customers can't access your private app!
      const signatureLink = `${window.location.origin}/public/sign/${selectedContract.id}`;
      
      if (signingMode === "remote") {
        // Update contract with signature link
        await updateDoc(doc(db, "contracts", selectedContract.id), {
          signatureLink: signatureLink,
          status: "Sent - Awaiting Client Signature",
          sentAt: new Date().toISOString(),
          clientEmail: customerEmail,
        });

        // Email will be sent via Cloud Function in Phase 2
        // For now, show the link so you can copy/text it
        console.log("Email would be sent to:", customerEmail);
        console.log("Signature link:", signatureLink);

        Swal.fire({
          icon: "success",
          title: "Contract Link Generated!",
          html: `
            <p><strong>Copy this link and text/email it to your customer:</strong></p>
            <textarea readonly onclick="this.select()" 
              style="width:100%; padding:10px; font-size:12px; margin:10px 0; border: 2px solid #1565c0; border-radius:4px;"
              rows="3">${signatureLink}</textarea>
            <p style="font-size:0.9em; color:#666; margin-top:10px;">
              📱 <strong>Text message example:</strong><br>
              "Hi ${selectedContract.clientName}, here's your contract to review and sign: ${signatureLink}"
            </p>
            <p style="font-size:0.85em; color:#999; margin-top:15px;">
              ✅ This link is SAFE - customer can ONLY see their contract, nothing else in your system
            </p>
          `,
          confirmButtonText: "OK",
          width: '600px',
        });

        fetchContracts(); // Refresh list
      } else {
        // In-person signing - open contract editor
        navigate(`/contract/${selectedContract.id}`);
      }

      setSendDialogOpen(false);
    } catch (error) {
      console.error("Error sending contract:", error);
      Swal.fire("Error", "Failed to send contract.", "error");
    }
  };

  const getStatusColor = (contract) => {
    if (contract.clientSignature && contract.contractorSignature) {
      return "success"; // Fully signed
    } else if (contract.clientSignature) {
      return "warning"; // Client signed, awaiting owner
    } else if (contract.status === "Sent - Awaiting Client Signature") {
      return "info"; // Sent but not signed
    }
    return "default"; // Pending
  };

  const getStatusLabel = (contract) => {
    if (contract.clientSignature && contract.contractorSignature) {
      return "✅ Fully Signed";
    } else if (contract.clientSignature) {
      return "🟡 Awaiting Owner Signature";
    } else if (contract.status === "Sent - Awaiting Client Signature") {
      return "📧 Sent - Not Signed Yet";
    }
    return contract.status || "Pending";
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Loading contracts...
        </Typography>
      </Box>
    );
  }

  if (contracts.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Contracts Dashboard
        </Typography>
        <Typography sx={{ mt: 3 }}>No contracts found.</Typography>
      </Box>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Contracts Dashboard
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {contracts.map((contract) => (
            <Card key={contract.id} sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {contract.clientName || "Unnamed Client"}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Amount: ${Number(contract.amount || 0).toFixed(2)}
                </Typography>
                <Chip
                  label={getStatusLabel(contract)}
                  color={getStatusColor(contract)}
                  sx={{ mt: 1 }}
                />
              </CardContent>
              <CardActions sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2 }}>
                {contract.clientSignature && !contract.contractorSignature && (
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    startIcon={<TouchAppIcon />}
                    onClick={() => handleViewEdit(contract.id)}
                  >
                    Sign Now (Darren)
                  </Button>
                )}
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<SendIcon />}
                  onClick={() => handleOpenSendDialog(contract)}
                >
                  Send for Signature
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PictureAsPdfIcon />}
                  onClick={() => handleGeneratePDF(contract)}
                >
                  View PDF
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<EditIcon />}
                  onClick={() => handleViewEdit(contract.id)}
                >
                  View / Edit
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<CalendarTodayIcon />}
                  onClick={() => handleScheduleJob(contract)}
                >
                  Schedule Job
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  startIcon={<DeleteIcon />}
                  onClick={() =>
                    handleDeleteContract(contract.id, contract.clientName || "this")
                  }
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>

        {/* Send Dialog */}
        <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Send Contract for Signature</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Choose how the contract will be signed
            </Alert>
            
            <RadioGroup value={signingMode} onChange={(e) => setSigningMode(e.target.value)}>
              <FormControlLabel 
                value="in-person" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="subtitle2">👋 Sign Now (In-Person)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Customer is here - hand them the tablet to sign now
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="remote" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="subtitle2">📧 Send Signature Link (Remote)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Email a link - customer signs from their phone later
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>

            {signingMode === "remote" && (
              <TextField
                label="Customer Email"
                type="email"
                fullWidth
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                sx={{ mt: 2 }}
                placeholder="customer@example.com"
                helperText="We'll email a signature link to this address"
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSendForSignature} startIcon={
              signingMode === "in-person" ? <TouchAppIcon /> : <EmailIcon />
            }>
              {signingMode === "in-person" ? "Open Contract" : "Send Email"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Desktop view
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Contracts Dashboard
      </Typography>
      <TableContainer
        component={Paper}
        sx={{
          mt: 2,
          borderRadius: 2,
          overflowX: "auto",
          boxShadow: 3,
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.clientName || "Unnamed Client"}</TableCell>
                <TableCell>
                  ${Number(contract.amount || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(contract)}
                    color={getStatusColor(contract)}
                    size="small"
                  />
                </TableCell>

                <TableCell>
                  {contract.clientSignature && !contract.contractorSignature && (
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      startIcon={<TouchAppIcon />}
                      onClick={() => handleViewEdit(contract.id)}
                      sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                    >
                      Sign Now
                    </Button>
                  )}
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SendIcon />}
                    onClick={() => handleOpenSendDialog(contract)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Send
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() => handleGeneratePDF(contract)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    PDF
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleViewEdit(contract.id)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    View / Edit
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CalendarTodayIcon />}
                    onClick={() => handleScheduleJob(contract)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Schedule
                  </Button>


                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() =>
                      handleDeleteContract(
                        contract.id,
                        contract.clientName || "this"
                      )
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Send Contract for Signature</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Customer:</strong> {selectedContract?.clientName}<br />
            <strong>Amount:</strong> ${selectedContract?.amount?.toFixed(2)}<br />
            <strong>Deposit (50%):</strong> ${(selectedContract?.amount * 0.5)?.toFixed(2)}
          </Alert>
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            How will this contract be signed?
          </Typography>
          
          <RadioGroup value={signingMode} onChange={(e) => setSigningMode(e.target.value)}>
            <FormControlLabel 
              value="in-person" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="subtitle2">👋 Sign Now (In-Person)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Customer is here with you - hand them the tablet/phone to sign immediately
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel 
              value="remote" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="subtitle2">📧 Send Signature Link (Remote)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Email a link - customer opens on their phone and signs remotely
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>

          {signingMode === "remote" && (
            <TextField
              label="Customer Email Address"
              type="email"
              fullWidth
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              sx={{ mt: 3 }}
              placeholder="customer@example.com"
              helperText="We'll email the signature link to this address"
              required
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSendForSignature} 
            startIcon={signingMode === "in-person" ? <TouchAppIcon /> : <EmailIcon />}
            size="large"
          >
            {signingMode === "in-person" ? "Open Contract to Sign" : "Send Signature Email"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}