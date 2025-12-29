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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  Chip,
  MenuItem,
  Select,
  Box,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentIcon from "@mui/icons-material/Payment";
import generateInvoicePDF from "./pdf/generateInvoicePDF";

export default function InvoicesDashboard() {
  const [invoices, setInvoices] = useState([]);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchInvoices = async () => {
    try {
      const snap = await getDocs(collection(db, "invoices"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInvoices(data);
    } catch (err) {
      console.error("Error loading invoices:", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const ref = doc(db, "invoices", id);
      await updateDoc(ref, { status: newStatus });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, status: newStatus } : inv
        )
      );
    } catch (err) {
      console.error("Error updating invoice status:", err);
    }
  };

  const handleDelete = async (id, client) => {
    const confirm = await Swal.fire({
      title: `Delete ${client}'s invoice?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
    });
    if (!confirm.isConfirmed) return;
    await deleteDoc(doc(db, "invoices", id));
    setInvoices(invoices.filter((x) => x.id !== id));
  };

  const handlePDF = async (inv) => {
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

      // NEW: Load expenses for this job
      let expenses = [];
      if (inv.jobId) {
        try {
          const expensesSnap = await getDocs(collection(db, "expenses"));
          expenses = expensesSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((e) => e.jobId === inv.jobId);
          console.log(`📊 Loaded ${expenses.length} expenses for invoice PDF`);
        } catch (e) {
          console.warn("Failed to load expenses:", e);
        }
      }

      // Generate PDF with expenses and material breakdown flag
      const pdfDoc = await generateInvoicePDF(
        {
          ...inv,
          logoDataUrl,
        },
        expenses, // Pass expenses array
        inv.includeMaterialBreakdown || false // Pass material breakdown flag
      );

      // ✅ MOBILE-FRIENDLY PDF VIEWING
      const pdfBlob = pdfDoc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Detect if mobile device
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobileDevice) {
        // For mobile: Create iframe viewer overlay
        const viewerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Invoice - ${inv.clientName || 'View'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
    }
    .btn {
      background: white;
      color: #1976d2;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn:active {
      background: #f0f0f0;
    }
    iframe {
      position: fixed;
      top: 60px;
      left: 0;
      width: 100%;
      height: calc(100% - 60px);
      border: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice - ${inv.clientName || 'View'}</h1>
    <a href="${pdfUrl}" download="Invoice_${inv.clientName || 'Unknown'}.pdf" class="btn">Download</a>
  </div>
  <iframe src="${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH"></iframe>
</body>
</html>`;

        // Open viewer in new tab
        const viewerBlob = new Blob([viewerHtml], { type: 'text/html' });
        const viewerUrl = URL.createObjectURL(viewerBlob);
        const newWindow = window.open(viewerUrl, '_blank');

        if (!newWindow) {
          // Popup blocked - fallback to download
          const link = document.createElement("a");
          link.href = pdfUrl;
          link.download = `Invoice_${inv.clientName || 'Unknown'}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          Swal.fire({
            icon: "info",
            title: "PDF Downloaded",
            text: "Check your downloads folder",
            timer: 2000,
          });
        }
      } else {
        // For desktop: Direct PDF view
        window.open(pdfUrl, "_blank");
      }
    } catch (error) {
      console.error("PDF Generation Error:", error);
      Swal.fire("Error", "Failed to generate PDF. Please try again.", "error");
    }
  };

  const handleEdit = (invoiceId) => {
    navigate(`/invoice/${invoiceId}`);
  };

  const getColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "paid": return "success";
      case "sent": return "info";
      case "overdue": return "error";
      default: return "warning";
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography 
        variant="h5" 
        gutterBottom
        sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
      >
        Invoices
      </Typography>

      {/* Mobile: Card Layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {invoices.map((inv) => (
          <Card key={inv.id} sx={{ mb: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                    {inv.clientName}
                  </Typography>
                  <Typography variant="h5" color="primary" sx={{ fontWeight: 700, mt: 1 }}>
                    ${inv.total || inv.amount || 0}
                  </Typography>
                </Box>
                <Chip
                  label={inv.status || "Pending"}
                  color={getColor(inv.status)}
                  sx={{ fontWeight: "bold" }}
                />
              </Box>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Change Status</InputLabel>
                <Select
                  value={inv.status || "Pending"}
                  label="Change Status"
                  onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Sent">Sent</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                  <MenuItem value="Overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </CardContent>

            <CardActions sx={{ p: 2, pt: 0, flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => handlePDF(inv)}
                fullWidth
              >
                View PDF
              </Button>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<PaymentIcon />}
                onClick={() => navigate(`/payment-tracker/${inv.id}`)}
                fullWidth
              >
                Track Payments
              </Button>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<EditIcon />}
                onClick={() => handleEdit(inv.id)}
                fullWidth
              >
                Edit Invoice
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => handleDelete(inv.id, inv.clientName || "this")}
                fullWidth
              >
                Delete
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>

      {/* Desktop: Table Layout */}
      <Paper sx={{ display: { xs: 'none', md: 'block' }, mt: 2, borderRadius: 2, overflowX: "auto", boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.clientName}</TableCell>
                <TableCell>${inv.total || inv.amount || 0}</TableCell>
                <TableCell>
                  <Chip
                    label={inv.status || "Pending"}
                    color={getColor(inv.status)}
                    sx={{ fontWeight: "bold", mr: 1 }}
                  />
                  <Select
                    size="small"
                    value={inv.status || "Pending"}
                    onChange={(e) =>
                      handleStatusChange(inv.id, e.target.value)
                    }
                  >
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Sent">Sent</MenuItem>
                    <MenuItem value="Paid">Paid</MenuItem>
                    <MenuItem value="Overdue">Overdue</MenuItem>
                  </Select>
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() => handlePDF(inv)}
                    sx={{ mr: 1 }}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<PaymentIcon />}
                    onClick={() => navigate(`/payment-tracker/${inv.id}`)}
                    sx={{ mr: 1 }}
                  >
                    Payments
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEdit(inv.id)}
                    sx={{ mr: 1 }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() =>
                      handleDelete(inv.id, inv.clientName || "this")
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}