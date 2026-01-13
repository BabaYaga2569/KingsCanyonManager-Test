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
import VisibilityIcon from "@mui/icons-material/Visibility";
import jsPDF from "jspdf";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
};

// COMPREHENSIVE NDA TEXT - 8 SECTIONS
const NDA_PREVIEW_TEXT = `WORKER CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT
NON-SOLICITATION & NON-COMPETE AGREEMENT

This Agreement is entered into by and between Kings Canyon Landscaping LLC ("Company") and the undersigned ("Recipient").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONFIDENTIAL INFORMATION

The Recipient acknowledges that during their employment or engagement, they may have access to confidential and proprietary information, including but not limited to:

• Customer lists, past, current, and future customers
• Customer contact information and job locations
• Pricing, bids, estimates, and invoices
• Business strategies, operations, and scheduling
• Trade secrets and proprietary methods
• Financial records
• Employee and subcontractor information

All such information is the exclusive property of the Company.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. NON-DISCLOSURE OBLIGATIONS

The Recipient agrees to:

• Keep all confidential information strictly confidential
• Not disclose confidential information to any third party
• Not use confidential information for personal benefit or outside business
• Return all Company property, records, accounts, and materials immediately upon termination

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. NON-SOLICITATION OF CUSTOMERS

The Recipient shall not, during employment or at any time thereafter, directly or indirectly:

• Contact, solicit, divert, or perform work for any past, current, or future customer of the Company
• Attempt to take work from the Company's customers for personal gain or another business
• Circumvent the Company to secure work for themselves, even if the Recipient originally found the job

This applies whether the Recipient is an employee, independent contractor, or otherwise associated with the Company at the time of the conduct.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. LIQUIDATED DAMAGES – CUSTOMER POACHING

The Recipient agrees that any violation of Section 3 (Non-Solicitation) shall result in liquidated damages in the amount of $15,000 per violation, which the parties agree is a reasonable estimate of damages and not a penalty. This amount is due immediately upon breach.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. UNAUTHORIZED USE OF COMPANY NAME OR ACCOUNTS

If the Recipient is found using:
• The Company name
• Company phone numbers
• Company email accounts
• Company branding, licenses, or reputation

to make money for themselves or another party without written authorization, the following shall apply:

• Immediate termination of employment
• A $1,500 liquidated damages fee per occurrence
• Possible legal action for additional damages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. DURATION

This Agreement remains in effect during employment and for two (2) years following termination, except for Sections 3, 4, and 5, which survive termination indefinitely where allowed by law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. REMEDIES

The Recipient acknowledges that breach of this Agreement may result in:

• Immediate termination
• Injunctive relief
• Recovery of damages, liquidated damages, and attorney's fees

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. GOVERNING LAW

This Agreement shall be governed by and enforced under the laws of the State of Arizona.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACKNOWLEDGMENT & SIGNATURES

By signing below, the Recipient acknowledges that they have read, understood, and agree to be legally bound by this Agreement.`;

// OLD NDA TEXT - Keep for PDF generation of signed NDAs
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
  doc.text(`Position: ${crewMember.position || "Crew Member"}`, 50, 216);
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
  const [crews, setCrews] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    hourlyRate: "",
    notes: "",
    isAvailable: true,
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchCrews();
  }, []);

  const fetchCrews = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "crews"));
      const crewsList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCrews(crewsList);
    } catch (error) {
      console.error("Error fetching crews:", error);
      Swal.fire("Error", "Failed to load crew members.", "error");
    }
  };

  const handleOpenDialog = (crew = null) => {
    if (crew) {
      setSelectedCrew(crew);
      setFormData({
        name: crew.name || "",
        role: crew.role || "",
        phone: crew.phone || "",
        email: crew.email || "",
        hourlyRate: crew.hourlyRate || "",
        notes: crew.notes || "",
        isAvailable: crew.isAvailable !== undefined ? crew.isAvailable : true,
      });
    } else {
      setSelectedCrew(null);
      setFormData({
        name: "",
        role: "",
        phone: "",
        email: "",
        hourlyRate: "",
        notes: "",
        isAvailable: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedCrew(null);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      Swal.fire("Incomplete", "Name and phone are required.", "warning");
      return;
    }

    try {
      if (selectedCrew) {
        // Update existing crew member
        await updateDoc(doc(db, "crews", selectedCrew.id), {
          ...formData,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 0,
        });
        Swal.fire("Updated!", "Crew member updated successfully.", "success");
      } else {
        // Add new crew member
        await addDoc(collection(db, "crews"), {
          ...formData,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 0,
          createdAt: new Date().toISOString(),
        });
        Swal.fire("Added!", "New crew member added successfully.", "success");
      }

      fetchCrews();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving crew member:", error);
      Swal.fire("Error", "Failed to save crew member.", "error");
    }
  };

  const handleDelete = async (crew) => {
    const confirm = await Swal.fire({
      title: `Delete ${crew.name}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete",
    });

    if (confirm.isConfirmed) {
      try {
        await deleteDoc(doc(db, "crews", crew.id));
        setCrews(crews.filter((c) => c.id !== crew.id));
        Swal.fire("Deleted!", "Crew member has been removed.", "success");
      } catch (error) {
        console.error("Error deleting crew member:", error);
        Swal.fire("Error", "Failed to delete crew member.", "error");
      }
    }
  };

  const toggleAvailability = async (crew) => {
    try {
      await updateDoc(doc(db, "crews", crew.id), {
        isAvailable: !crew.isAvailable,
      });
      fetchCrews();
    } catch (error) {
      console.error("Error toggling availability:", error);
      Swal.fire("Error", "Failed to update availability.", "error");
    }
  };

  const handleSendNDA = async (crew) => {
    try {
      const ndaLink = `${window.location.origin}/public/nda/${crew.id}`;
      
      await Swal.fire({
        icon: "success",
        title: "NDA Link Generated!",
        html: `
          <p>Copy this link and text/email it to <strong>${crew.name}</strong>:</p>
          <input type="text" value="${ndaLink}" id="ndaLink" readonly style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;" />
          <br/>
          <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
            <strong>📱 Text message example:</strong><br/>
            "Hi ${crew.name}, please review and sign this NDA. ${ndaLink}"
          </p>
        `,
        confirmButtonText: "OK",
        didOpen: () => {
          const input = document.getElementById("ndaLink");
          input.focus();
          input.select();
        },
      });
    } catch (error) {
      console.error("Error generating NDA link:", error);
      Swal.fire("Error", "Failed to generate NDA link.", "error");
    }
  };

  const handleViewNDA = async (crew) => {
    try {
      // Load logo
      let logoDataUrl = null;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            logoDataUrl = canvas.toDataURL("image/png");
            resolve();
          };
          img.onerror = reject;
          img.src = "/logo-kcl.png";
        });
      } catch (e) {
        console.warn("Logo loading failed, continuing without it:", e);
      }

      const pdf = await generateNDAPDF(crew, logoDataUrl);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      window.open(pdfUrl, '_blank');
      
      Swal.fire({
        icon: "success",
        title: "NDA Opened!",
        text: `Viewing signed NDA for ${crew.name}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating NDA PDF:", error);
      Swal.fire("Error", "Failed to generate PDF. Please try again.", "error");
    }
  };

  const handlePreviewNDA = () => {
    setPreviewDialog(true);
  };

  const handleClosePreview = () => {
    setPreviewDialog(false);
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
                <Box sx={{ display: "flex", gap: 1, width: "100%", flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color={crew.ndaStatus === "Signed" ? "success" : "primary"}
                    onClick={() => handleSendNDA(crew)}
                    disabled={crew.ndaStatus === "Signed"}
                    sx={{ flex: 1, minWidth: '100px' }}
                  >
                    {crew.ndaStatus === "Signed" ? "✅ Signed" : "📝 Send NDA"}
                  </Button>
                  
                  {/* Preview NDA Button - Shows for everyone */}
                  <Button
                    variant="outlined"
                    size="small"
                    color="info"
                    startIcon={<VisibilityIcon />}
                    onClick={handlePreviewNDA}
                    sx={{ flex: 1, minWidth: '100px' }}
                  >
                    Preview
                  </Button>
                  
                  {/* View Signed NDA Button - Only show if signed */}
                  {crew.ndaStatus === "Signed" && (
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={() => handleViewNDA(crew)}
                      sx={{ flex: 1, minWidth: '100px' }}
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

      {/* Add/Edit Crew Member Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedCrew ? "Edit Crew Member" : "Add Crew Member"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label="Role / Position"
              name="role"
              value={formData.role}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Foreman, Laborer"
            />
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              fullWidth
              required
              placeholder="(928) 555-1234"
            />
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              type="email"
              placeholder="worker@example.com"
            />
            <TextField
              label="Hourly Rate"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleChange}
              fullWidth
              type="number"
              placeholder="18.00"
            />
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              fullWidth
              multiline
              rows={3}
              placeholder="Any additional information..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {selectedCrew ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* NDA Preview Dialog */}
      <Dialog 
        open={previewDialog} 
        onClose={handleClosePreview} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh' }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#1565c0', color: 'white' }}>
          📄 NDA Template Preview
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Typography 
            component="pre" 
            sx={{ 
              whiteSpace: "pre-wrap", 
              fontFamily: "inherit",
              fontSize: "0.95rem",
              lineHeight: 1.6
            }}
          >
            {NDA_PREVIEW_TEXT}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClosePreview} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}