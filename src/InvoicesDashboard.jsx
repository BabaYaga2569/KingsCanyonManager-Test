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
    } catch (_) {}
    
    const pdfDoc = await generateInvoicePDF({
      ...inv,
      logoDataUrl,
      footerPath: "/footer-kcl.png",
    });

    // Open in new tab for preview
    const pdfBlob = pdfDoc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const handleEdit = (invoiceId) => {
    navigate(`/invoice/${invoiceId}`);
  };

  const handleCollectPayment = (invoice) => {
    navigate(`/collect-payment?invoiceId=${invoice.id}`);
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
        {invoices.map((inv) => {
          const isPaid = (inv.status || "").toLowerCase() === "paid";
          return (
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
                {!isPaid && (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<PaymentIcon />}
                    onClick={() => handleCollectPayment(inv)}
                    fullWidth
                  >
                    💰 Collect Payment
                  </Button>
                )}
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
          );
        })}
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
            {invoices.map((inv) => {
              const isPaid = (inv.status || "").toLowerCase() === "paid";
              return (
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
                    {!isPaid && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<PaymentIcon />}
                        onClick={() => handleCollectPayment(inv)}
                        sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                      >
                        Collect Payment
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={() => handlePDF(inv)}
                      sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(inv.id)}
                      sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
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
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}