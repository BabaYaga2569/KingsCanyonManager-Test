import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Container,
  Typography,
  Button,
  TextField,
  Box,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Swal from "sweetalert2";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
};

const NDA_TEXT = `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into by and between Kings Canyon Landscaping LLC ("Company") and the undersigned employee/contractor ("Recipient").

1. CONFIDENTIAL INFORMATION
The Recipient acknowledges that during their engagement with the Company, they may have access to confidential and proprietary information including but not limited to:
   • Customer lists, contacts, and information
   • Pricing structures and bid information
   • Business strategies and operations
   • Trade secrets and proprietary methods
   • Financial information
   • Employee information

2. NON-DISCLOSURE OBLIGATIONS
The Recipient agrees to:
   • Keep all confidential information strictly confidential
   • Not disclose any confidential information to third parties
   • Not use confidential information for personal benefit
   • Return all company materials upon termination of employment

3. DURATION
This agreement remains in effect during employment and for a period of two (2) years following termination of employment or engagement with the Company.

4. REMEDIES
The Recipient acknowledges that violation of this agreement may result in immediate termination and legal action for damages.

5. GOVERNING LAW
This agreement shall be governed by the laws of the State of Arizona.

By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.
`;

// Generate PDF of signed NDA
const generateNDAPDF = async (crewMember, logoDataUrl = null) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Header with logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 40, 42, 80, 80);
    } catch (e) {
      console.warn("Logo failed:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, 140, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Bullhead City, AZ", 140, 84);
  doc.text(`${COMPANY.phone} • ${COMPANY.email}`, 140, 100);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NON-DISCLOSURE AGREEMENT", W / 2, 140, { align: "center" });

  // Employee Info Box
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  doc.rect(40, 160, W - 80, 80);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Employee Information:", 50, 180);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${crewMember.name || "N/A"}`, 50, 200);
  doc.text(`Position: ${crewMember.role || "Crew Member"}`, 50, 216);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 350, 200);
  doc.text(`Phone: ${crewMember.phone || "N/A"}`, 350, 216);

  // NDA Text
  let y = 260;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const lines = doc.splitTextToSize(NDA_TEXT.trim(), W - 80);
  lines.forEach((line) => {
    if (y > H - 280) {
      doc.addPage();
      y = 60;
      doc.setDrawColor(60);
      doc.setLineWidth(1);
      doc.rect(28, 28, W - 56, H - 56);
    }
    doc.text(line, 40, y);
    y += 12;
  });

  // Signatures section
  if (y > H - 260) {
    doc.addPage();
    y = 60;
    doc.setDrawColor(60);
    doc.setLineWidth(1);
    doc.rect(28, 28, W - 56, H - 56);
  }

  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Signatures", 40, y);
  y += 20;

  const sigBoxH = 80;
  const col1X = 40;
  const col2X = W / 2 + 10;
  const boxW = W - 40 - col2X;

  // Draw signature boxes
  doc.setDrawColor(120);
  doc.rect(col1X, y, boxW, sigBoxH);
  doc.rect(col2X, y, boxW, sigBoxH);

  // Add signatures
  if (crewMember.ndaSignature) {
    doc.addImage(crewMember.ndaSignature, "PNG", col1X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }
  if (crewMember.ndaCompanySignature) {
    doc.addImage(crewMember.ndaCompanySignature, "PNG", col2X + 6, y + 6, boxW - 12, sigBoxH - 12);
  }

  y += sigBoxH + 16;

  // Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Employee Signature", col1X, y);
  doc.text("Company Representative", col2X, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Name: ${crewMember.name || "N/A"}`, col1X, y);
  doc.text(`Name: ${COMPANY.owner}`, col2X, y);
  y += 12;

  doc.text(`Signed: ${crewMember.ndaSignedAt || "—"}`, col1X, y);
  doc.text(`Signed: ${crewMember.ndaCompanySignedAt || "—"}`, col2X, y);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a legally binding document. Keep a copy for your records.",
    W / 2,
    H - 50,
    { align: "center" }
  );

  return doc;
};

export default function CrewManager() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
  const [crews, setCrews] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    hourlyRate: "",
    isAvailable: true,
    notes: "",
  });

  useEffect(() => {
    fetchCrews();
  }, []);

  const fetchCrews = async () => {
    try {
      const snap = await getDocs(collection(db, "crews"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCrews(data);
    } catch (error) {
      console.error("Error fetching crews:", error);
    }
  };

  const handleOpenDialog = (crew = null) => {
    if (crew) {
      setEditingCrew(crew);
      setFormData({
        name: crew.name || "",
        phone: crew.phone || "",
        email: crew.email || "",
        role: crew.role || "",
        hourlyRate: crew.hourlyRate || "",
        isAvailable: crew.isAvailable !== false,
        notes: crew.notes || "",
      });
    } else {
      setEditingCrew(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        role: "",
        hourlyRate: "",
        isAvailable: true,
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCrew(null);
  };

  const handleSave = async () => {
    if (!formData.name) {
      Swal.fire("Missing Info", "Crew member name is required", "warning");
      return;
    }

    try {
      if (editingCrew) {
        // Update existing
        await updateDoc(doc(db, "crews", editingCrew.id), formData);
        Swal.fire("Updated!", "Crew member updated successfully", "success");
      } else {
        // Create new
        await addDoc(collection(db, "crews"), {
          ...formData,
          createdAt: new Date().toISOString(),
        });
        Swal.fire("Added!", "New crew member added successfully", "success");
      }
      fetchCrews();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving crew:", error);
      Swal.fire("Error", "Failed to save crew member", "error");
    }
  };

  const handleDelete = async (crew) => {
    const result = await Swal.fire({
      title: `Delete ${crew.name}?`,
      text: "This will remove them from the crew list",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "crews", crew.id));
        setCrews(crews.filter((c) => c.id !== crew.id));
        Swal.fire("Deleted!", "Crew member removed", "success");
      } catch (error) {
        console.error("Error deleting crew:", error);
        Swal.fire("Error", "Failed to delete crew member", "error");
      }
    }
  };

  const toggleAvailability = async (crew) => {
    try {
      const newStatus = !crew.isAvailable;
      await updateDoc(doc(db, "crews", crew.id), { isAvailable: newStatus });
      setCrews(crews.map((c) => 
        c.id === crew.id ? { ...c, isAvailable: newStatus } : c
      ));
    } catch (error) {
      console.error("Error updating availability:", error);
    }
  };

  // Send NDA for remote signing
  const handleSendNDA = async (crew) => {
    try {
      const ndaLink = `${window.location.origin}/public/nda/${crew.id}`;
      
      await updateDoc(doc(db, "crews", crew.id), {
        ndaStatus: "Sent - Awaiting Signature",
        ndaSentAt: new Date().toISOString(),
        ndaLink: ndaLink,
      });

      Swal.fire({
        icon: "success",
        title: "NDA Link Generated!",
        html: `
          <p><strong>Copy this link and text/email it to ${crew.name}:</strong></p>
          <textarea readonly onclick="this.select()" 
            style="width:100%; padding:10px; font-size:12px; margin:10px 0; border: 2px solid #1565c0; border-radius:4px;"
            rows="3">${ndaLink}</textarea>
          <p style="font-size:0.9em; color:#666; margin-top:10px;">
            📱 <strong>Text message example:</strong><br>
            "Hi ${crew.name}, please review and sign this NDA: ${ndaLink}"
          </p>
        `,
        confirmButtonText: "OK",
        width: '600px',
      });

      fetchCrews();
    } catch (error) {
      console.error("Error sending NDA:", error);
      Swal.fire("Error", "Failed to generate NDA link.", "error");
    }
  };

  // View/Download signed NDA PDF
  const handleViewNDA = async (crew) => {
    if (!crew.ndaSignature || crew.ndaStatus !== "Signed") {
      Swal.fire("Not Signed", "This crew member hasn't signed the NDA yet.", "warning");
      return;
    }

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

      const pdfDoc = await generateNDAPDF(crew, logoDataUrl);
      
      const fileName = `NDA_${(crew.name || "Employee").replace(/\s+/g, "_")}_Signed.pdf`;
      pdfDoc.save(fileName);

      Swal.fire({
        icon: "success",
        title: "PDF Downloaded!",
        text: `Saved as: ${fileName}`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      Swal.fire("Error", "Failed to generate PDF. Please try again.", "error");
    }
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          👷 Crew Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          size={isMobile ? "small" : "medium"}
        >
          {isMobile ? "Add" : "Add Crew Member"}
        </Button>
      </Box>

      <Grid container spacing={2}>
        {crews.map((crew) => (
          <Grid item xs={12} sm={6} md={4} key={crew.id}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon color="primary" />
                    <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                      {crew.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {crew.ndaStatus && (
                      <Chip
                        label={crew.ndaStatus === "Signed" ? "NDA Signed" : "NDA Pending"}
                        color={crew.ndaStatus === "Signed" ? "success" : "warning"}
                        size="small"
                      />
                    )}
                    <Chip
                      label={crew.isAvailable ? "Available" : "Busy"}
                      color={crew.isAvailable ? "success" : "warning"}
                      size="small"
                      onClick={() => toggleAvailability(crew)}
                      sx={{ cursor: "pointer" }}
                    />
                  </Box>
                </Box>

                {crew.role && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Role:</strong> {crew.role}
                  </Typography>
                )}

                {crew.phone && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Phone:</strong> {crew.phone}
                  </Typography>
                )}

                {crew.email && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Email:</strong> {crew.email}
                  </Typography>
                )}

                {crew.hourlyRate && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Rate:</strong> ${crew.hourlyRate}/hr
                  </Typography>
                )}

                {crew.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
                    {crew.notes}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ justifyContent: "space-between", p: 2, pt: 0, flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color={crew.ndaStatus === "Signed" ? "success" : "primary"}
                    onClick={() => handleSendNDA(crew)}
                    disabled={crew.ndaStatus === "Signed"}
                    sx={{ flex: 1 }}
                  >
                    {crew.ndaStatus === "Signed" ? "✅ Signed" : "📝 Send NDA"}
                  </Button>
                  
                  {/* View NDA Button - Only show if signed */}
                  {crew.ndaStatus === "Signed" && (
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={() => handleViewNDA(crew)}
                      sx={{ flex: 1 }}
                    >
                      View NDA
                    </Button>
                  )}
                </Box>
                
                <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenDialog(crew)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(crew)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {crews.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: "center", py: 8 }}>
              <PersonIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No Crew Members Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add your first crew member to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Crew Member
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingCrew ? "Edit Crew Member" : "Add New Crew Member"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Role / Position"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., Foreman, Laborer, Equipment Operator"
              fullWidth
            />

            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />

            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />

            <TextField
              label="Hourly Rate ($)"
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
            />

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              placeholder="Skills, certifications, availability, etc."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingCrew ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}