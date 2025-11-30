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
} from "@mui/material";
import Swal from "sweetalert2";
import generateInvoicePDF from "./pdf/generateInvoicePDF"; // we’ll add this file next

export default function InvoicesDashboard() {
  const [invoices, setInvoices] = useState([]);

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
    const doc = await generateInvoicePDF({
  ...inv,
  logoDataUrl,
  footerPath: "/footer-kcl.png",
});

    doc.save(`Invoice_${inv.clientName || "Client"}.pdf`);
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
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        Invoices
      </Typography>
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
                  onClick={() => handlePDF(inv)}
                  sx={{ mr: 1 }}
                >
                  PDF
                </Button>
                <Button
                  variant="outlined"
                  color="error"
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
  );
}
