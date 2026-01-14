import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  addDoc,
  query,
  where,
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
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentIcon from "@mui/icons-material/Payment";
import SortIcon from "@mui/icons-material/Sort";
import moment from "moment";
import generateInvoicePDF from "./pdf/generateInvoicePDF";
import { markAsViewed } from './useNotificationCounts';

export default function InvoicesDashboard() {
  const [invoices, setInvoices] = useState([]);
  const [sortedInvoices, setSortedInvoices] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const navigate = useNavigate();
  const location = useLocation(); // ADD THIS LINE
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
  }, [location.pathname, location.key]); // This will definitely trigger
  
  useEffect(() => {
    markAsViewed('invoices');
  }, []);

  // Helper function to convert Firebase Timestamp to JavaScript Date
  const getDateFromInvoice = (invoice) => {
    try {
      // Check invoiceDate FIRST (the actual invoice date field)
      if (invoice.invoiceDate) {
        if (invoice.invoiceDate.toDate) {
          return invoice.invoiceDate.toDate();
        }
        return new Date(invoice.invoiceDate);
      }
      // Fallback to date field (legacy)
      if (invoice.date) {
        if (invoice.date.toDate) {
          return invoice.date.toDate();
        }
        return new Date(invoice.date);
      }
      // Last fallback to createdAt
      if (invoice.createdAt) {
        if (invoice.createdAt.toDate) {
          return invoice.createdAt.toDate(); // Firebase Timestamp
        }
        return new Date(invoice.createdAt); // String date
      }
      return null;
    } catch (error) {
      console.error("Error parsing date:", error);
      return null;
    }
  };

  // Helper function to format date for display
  const formatInvoiceDate = (invoice) => {
    const date = getDateFromInvoice(invoice);
    if (!date || isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString();
  };

  // Sort invoices whenever invoices or sortOrder changes
  useEffect(() => {
    const sorted = [...invoices].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          const dateA = getDateFromInvoice(a);
          const dateB = getDateFromInvoice(b);
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        case "oldest":
          const dateA2 = getDateFromInvoice(a);
          const dateB2 = getDateFromInvoice(b);
          return (dateA2?.getTime() || 0) - (dateB2?.getTime() || 0);
        case "name-asc":
          return (a.clientName || "").localeCompare(b.clientName || "");
        case "name-desc":
          return (b.clientName || "").localeCompare(a.clientName || "");
        case "amount-high":
          return parseFloat(b.total || b.amount || 0) - parseFloat(a.total || a.amount || 0);
        case "amount-low":
          return parseFloat(a.total || a.amount || 0) - parseFloat(b.total || b.amount || 0);
        case "status-unpaid":
          const aUnpaid = (a.status || "").toLowerCase() !== "paid" ? -1 : 1;
          const bUnpaid = (b.status || "").toLowerCase() !== "paid" ? -1 : 1;
          return aUnpaid - bUnpaid;
        case "status-paid":
          const aPaid = (a.status || "").toLowerCase() === "paid" ? -1 : 1;
          const bPaid = (b.status || "").toLowerCase() === "paid" ? -1 : 1;
          return aPaid - bPaid;
        default:
          return 0;
      }
    });
    setSortedInvoices(sorted);
  }, [invoices, sortOrder]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const ref = doc(db, "invoices", id);
      const invoiceSnap = await getDoc(ref);
      const invoiceData = invoiceSnap.data();
      const oldStatus = invoiceData.status;
      
      // ✅ AUTO-HANDLE: When changing to "Paid"
      if (newStatus === "Paid" && oldStatus !== "Paid") {
        const total = parseFloat(invoiceData.total || invoiceData.amount || 0);
        
        // Check if payment record exists
        const paymentsQuery = query(
          collection(db, "payments"),
          where("invoiceId", "==", id)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        
        // Create payment record if none exists
        if (paymentsSnap.empty) {
          await addDoc(collection(db, "payments"), {
            invoiceId: id,
            clientName: invoiceData.clientName,
            amount: total,
            paymentMethod: "other",
            paymentDate: moment().format("YYYY-MM-DD"),
            reference: "Auto-generated from invoice status change",
            notes: "Automatically created when invoice marked as Paid",
            receiptGenerated: false,
            createdAt: new Date().toISOString(),
          });
          console.log("✅ Auto-created payment record for tax reporting");
        }
        
        // Auto-complete related job
        if (invoiceData.jobId) {
          try {
            const jobRef = doc(db, "jobs", invoiceData.jobId);
            const jobSnap = await getDoc(jobRef);
            if (jobSnap.exists()) {
              await updateDoc(jobRef, {
                status: "Completed",
                completedDate: new Date().toISOString(),
              });
              console.log("✅ Auto-completed related job");
            }
          } catch (jobError) {
            console.warn("Could not auto-complete job:", jobError);
          }
        }
        
        // Update invoice with payment tracking fields
        await updateDoc(ref, { 
          status: newStatus,
          totalPaid: total,
          remainingBalance: 0,
          paymentStatus: "paid",
        });
      } else {
        // Normal status update
        await updateDoc(ref, { status: newStatus });
      }
      
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

      // Load expenses for this job
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
        expenses,
        inv.includeMaterialBreakdown || false
      );

      // Mobile-friendly PDF viewing
      const pdfBlob = pdfDoc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobileDevice) {
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

        const viewerBlob = new Blob([viewerHtml], { type: 'text/html' });
        const viewerUrl = URL.createObjectURL(viewerBlob);
        const newWindow = window.open(viewerUrl, '_blank');

        if (!newWindow) {
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
      case "making payments": return "warning";
      case "overdue": return "error";
      default: return "warning";
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header with Sort Dropdown */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          Invoices ({sortedInvoices.length})
        </Typography>

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
            <MenuItem value="newest">📅 Newest First</MenuItem>
            <MenuItem value="oldest">📅 Oldest First</MenuItem>
            <MenuItem value="name-asc">🔤 Client (A-Z)</MenuItem>
            <MenuItem value="name-desc">🔤 Client (Z-A)</MenuItem>
            <MenuItem value="amount-high">💰 Highest Amount</MenuItem>
            <MenuItem value="amount-low">💰 Lowest Amount</MenuItem>
            <MenuItem value="status-unpaid">💸 Unpaid First</MenuItem>
            <MenuItem value="status-paid">✅ Paid First</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Mobile: Card Layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {sortedInvoices.map((inv) => (
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

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                📅 Created: {formatInvoiceDate(inv)}
              </Typography>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Change Status</InputLabel>
                <Select
                  value={inv.status || "Pending"}
                  label="Change Status"
                  onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Sent">Sent</MenuItem>
                  <MenuItem value="Making Payments">Making Payments</MenuItem>
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

        {sortedInvoices.length === 0 && (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6">No Invoices Yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Invoices will appear here after you create them
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Desktop: Table Layout */}
      <Paper sx={{ display: { xs: 'none', md: 'block' }, mt: 2, borderRadius: 2, overflowX: "auto", boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInvoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.clientName}</TableCell>
                <TableCell>${inv.total || inv.amount || 0}</TableCell>
                <TableCell>{formatInvoiceDate(inv)}</TableCell>
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
                    <MenuItem value="Making Payments">Making Payments</MenuItem>
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

            {sortedInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan="5" style={{ padding: 40, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No Invoices Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Invoices will appear here after you create them
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}