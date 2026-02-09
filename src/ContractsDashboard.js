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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import SortIcon from "@mui/icons-material/Sort";
import { markAsViewed } from './useNotificationCounts';

const logo = "/logo-kcl.png";
const COMPANY_PHONE = "(928) 450-5733";

export default function ContractsDashboard() {
  const [contracts, setContracts] = useState([]);
  const [sortedContracts, setSortedContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedYear, setSelectedYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [signingMode, setSigningMode] = useState("remote");
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
  useEffect(() => {
    markAsViewed('contracts');
  }, []);

  // Helper function to parse dates from various formats
  const parseContractDate = (contract) => {
    // Try createdAt first
    if (contract.createdAt) {
      if (contract.createdAt.toDate) {
        return contract.createdAt.toDate();
      }
      const parsed = new Date(contract.createdAt);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    // Try contractDate
    if (contract.contractDate) {
      if (contract.contractDate.toDate) {
        return contract.contractDate.toDate();
      }
      const parsed = new Date(contract.contractDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    // Default to very old date so it sorts to the end
    return new Date(0);
  };

  // Filter contracts by year whenever contracts or selectedYear changes
  useEffect(() => {
    if (selectedYear === "all") {
      setFilteredContracts(contracts);
    } else {
      const filtered = contracts.filter((contract) => {
        const date = parseContractDate(contract);
        return date.getFullYear().toString() === selectedYear;
      });
      setFilteredContracts(filtered);
    }
  }, [contracts, selectedYear]);

  // Sort contracts whenever filteredContracts or sortOrder changes
  useEffect(() => {
    const sorted = [...filteredContracts].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return parseContractDate(b).getTime() - parseContractDate(a).getTime();
        case "oldest":
          return parseContractDate(a).getTime() - parseContractDate(b).getTime();
        case "name-asc":
          return (a.clientName || "").localeCompare(b.clientName || "");
        case "name-desc":
          return (b.clientName || "").localeCompare(a.clientName || "");
        case "amount-high":
          return parseFloat(b.amount || b.totalAmount || 0) - parseFloat(a.amount || a.totalAmount || 0);
        case "amount-low":
          return parseFloat(a.amount || a.totalAmount || 0) - parseFloat(b.amount || b.totalAmount || 0);
        case "status-unsigned":
          const aUnsigned = !(a.clientSignature && a.contractorSignature) ? -1 : 1;
          const bUnsigned = !(b.clientSignature && b.contractorSignature) ? -1 : 1;
          return aUnsigned - bUnsigned;
        case "status-signed":
          const aSigned = (a.clientSignature && a.contractorSignature) ? -1 : 1;
          const bSigned = (b.clientSignature && b.contractorSignature) ? -1 : 1;
          return aSigned - bSigned;
        default:
          return 0;
      }
    });
    setSortedContracts(sorted);
  }, [filteredContracts, sortOrder]);

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

    // Phase 2B: Removed - schedules created through workflow only
  // const handleScheduleJob = (contract) => {
  //   navigate("/schedule-job", { state: { contract } });
  // };

  const handleSendForSignature = async () => {
    if (signingMode === "remote" && !customerEmail) {
      Swal.fire("Email Required", "Please enter customer's email address.", "warning");
      return;
    }

    try {
      const signatureLink = `${window.location.origin}/public/sign/${selectedContract.id}`;
      
      if (signingMode === "remote") {
        await updateDoc(doc(db, "contracts", selectedContract.id), {
          signatureLink: signatureLink,
          status: "Sent - Awaiting Client Signature",
          sentAt: new Date().toISOString(),
          clientEmail: customerEmail,
        });

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
              ðŸ“± <strong>Text message example:</strong><br>
              "Hi ${selectedContract.clientName}, here's your contract to review and sign: ${signatureLink}"
            </p>
            <p style="font-size:0.85em; color:#999; margin-top:15px;">
              âœ… This link is SAFE - customer can ONLY see their contract, nothing else in your system
            </p>
          `,
          confirmButtonText: "OK",
          width: '600px',
        });

        fetchContracts();
      } else {
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
      return "success";
    } else if (contract.clientSignature) {
      return "warning";
    } else if (contract.status === "Sent - Awaiting Client Signature") {
      return "info";
    }
    return "default";
  };

  const getStatusLabel = (contract) => {
    if (contract.clientSignature && contract.contractorSignature) {
      return "Fully Signed";
    } else if (contract.clientSignature) {
      return "Awaiting Owner Signature";
    } else if (contract.status === "Sent - Awaiting Client Signature") {
      return "Sent - Not Signed Yet";
    }
    return contract.status || "Pending";
  };

  // Get unique years from contracts for year filter
  const getAvailableYears = () => {
    const years = new Set();
    contracts.forEach((contract) => {
      const date = parseContractDate(contract);
      if (date.getTime() > 0) {
        years.add(date.getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Newest year first
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

  if (sortedContracts.length === 0) {
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
        {/* Header with Sort and Year Dropdowns */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
          <Typography variant="h5">
            Contracts ({sortedContracts.length})
          </Typography>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {/* Year Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="year-label">Year</InputLabel>
              <Select
                labelId="year-label"
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <MenuItem value="all">All Years</MenuItem>
                {getAvailableYears().map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Sort Dropdown */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="sort-label">
                <SortIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                Sort By
              </InputLabel>
              <Select
                labelId="sort-label"
                value={sortOrder}
                label="Sort By"
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                <MenuItem value="amount-high">Highest Amount</MenuItem>
                <MenuItem value="amount-low">Lowest Amount</MenuItem>
                <MenuItem value="status-unsigned">Unsigned First</MenuItem>
                <MenuItem value="status-signed">Signed First</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {sortedContracts.map((contract) => (
            <Card key={contract.id} sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {contract.clientName || "Unnamed Client"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {contract.createdAt 
                    ? (contract.createdAt.toDate 
                        ? contract.createdAt.toDate().toLocaleDateString() 
                        : new Date(contract.createdAt).toLocaleDateString())
                    : contract.contractDate
                    ? (contract.contractDate.toDate
                        ? contract.contractDate.toDate().toLocaleDateString()
                        : new Date(contract.contractDate).toLocaleDateString())
                    : "—"}
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
                    <Typography variant="subtitle2">ðŸ‘‹ Sign Now (In-Person)</Typography>
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
                    <Typography variant="subtitle2">ðŸ“§ Send Signature Link (Remote)</Typography>
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
      {/* Header with Sort and Year Dropdowns */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5">
          Contracts Dashboard ({sortedContracts.length})
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          {/* Year Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="year-label">Year</InputLabel>
            <Select
              labelId="year-label"
              value={selectedYear}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <MenuItem value="all">All Years</MenuItem>
              {getAvailableYears().map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sort Dropdown */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="sort-label">
              <SortIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
              Sort By
            </InputLabel>
            <Select
              labelId="sort-label"
              value={sortOrder}
              label="Sort By"
              onChange={(e) => setSortOrder(e.target.value)}
            >
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
            <MenuItem value="name-asc">Name (A-Z)</MenuItem>
            <MenuItem value="name-desc">Name (Z-A)</MenuItem>
            <MenuItem value="amount-high">Highest Amount</MenuItem>
            <MenuItem value="amount-low">Lowest Amount</MenuItem>
            <MenuItem value="status-unsigned">Unsigned First</MenuItem>
            <MenuItem value="status-signed">Signed First</MenuItem>
          </Select>
        </FormControl>
        </Box>
      </Box>

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
              <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {sortedContracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.clientName || "Unnamed Client"}</TableCell>
                <TableCell>
                  {contract.createdAt 
                    ? (contract.createdAt.toDate 
                        ? contract.createdAt.toDate().toLocaleDateString() 
                        : new Date(contract.createdAt).toLocaleDateString())
                    : contract.contractDate
                    ? (contract.contractDate.toDate
                        ? contract.contractDate.toDate().toLocaleDateString()
                        : new Date(contract.contractDate).toLocaleDateString())
                    : "—"}
                </TableCell>
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
                  <Typography variant="subtitle2">ðŸ‘‹ Sign Now (In-Person)</Typography>
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
                  <Typography variant="subtitle2">ðŸ“§ Send Signature Link (Remote)</Typography>
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