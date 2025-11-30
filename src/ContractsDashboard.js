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
} from "@mui/material";
import Swal from "sweetalert2";
import generateContractPDF from "./pdf/generateContractPDF";
import { useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";

const logo = "/logo-kcl.png";

export default function ContractsDashboard() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Fetch contracts from Firestore
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

  // Delete a contract
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

  // Update contract status
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

  // ✅ Open PDF in new tab for BOTH mobile and desktop
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
      
      // Create blob and open in new tab (works on mobile AND desktop)
      const pdfBlob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      // Open in new tab/window
      const newWindow = window.open(blobUrl, "_blank");
      
      if (newWindow) {
        // Successfully opened
        Swal.fire({
          icon: "success",
          title: "PDF Opened!",
          text: `Viewing contract for ${contract.clientName}`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Blocked by pop-up blocker - offer download instead
        const filenameSafe = (contract.clientName || "Contract")
          .replace(/[^\w\- ]+/g, "_")
          .replace(/\s+/g, "_");
        pdf.save(`${filenameSafe}_Contract.pdf`);
        
        Swal.fire({
          icon: "info",
          title: "PDF Downloaded",
          text: "Pop-up was blocked. PDF downloaded to your device instead.",
          timer: 3000,
        });
      }
    };
  } catch (error) {
    console.error("PDF Generation Error:", error);
    Swal.fire("Error", "Failed to generate PDF.", "error");
  }
};

  // Navigate to the editor
  const handleViewEdit = (id) => {
    navigate(`/contract/${id}`);
  };

  // Navigate to schedule page with contract data
  const handleScheduleJob = (contract) => {
    navigate(`/schedule-job?contractId=${contract.id}`);
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

  // MOBILE VIEW - Cards
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
                  label={contract.status || "Pending"}
                  color={
                    contract.status === "Completed"
                      ? "success"
                      : contract.status === "Active"
                      ? "info"
                      : contract.status === "Cancelled"
                      ? "error"
                      : "warning"
                  }
                  onClick={() =>
                    handleStatusChange(
                      contract,
                      contract.status === "Completed" ? "Pending" : "Completed"
                    )
                  }
                  sx={{ cursor: "pointer", mt: 1 }}
                />
              </CardContent>
              <CardActions sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<EventIcon />}
                  onClick={() => handleScheduleJob(contract)}
                >
                  📅 Schedule This Job
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
      </Box>
    );
  }

  // DESKTOP VIEW - Table
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
                    label={contract.status || "Pending"}
                    color={
                      contract.status === "Completed"
                        ? "success"
                        : contract.status === "Active"
                        ? "info"
                        : contract.status === "Cancelled"
                        ? "error"
                        : "warning"
                    }
                    onClick={() =>
                      handleStatusChange(
                        contract,
                        contract.status === "Completed"
                          ? "Pending"
                          : "Completed"
                      )
                    }
                    sx={{ cursor: "pointer" }}
                  />
                </TableCell>

                <TableCell>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<EventIcon />}
                    onClick={() => handleScheduleJob(contract)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Schedule
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
    </Box>
  );
}