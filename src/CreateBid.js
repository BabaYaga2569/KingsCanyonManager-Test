import React, { useState, useEffect, useRef } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { generateSecureToken } from './utils/tokenUtils';
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  Autocomplete,
  Alert,
  Drawer,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Collapse,
} from "@mui/material";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import DesignVisualizer from "./components/DesignVisualizer";
import BrushIcon from "@mui/icons-material/Brush";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LandscapeIcon from "@mui/icons-material/Landscape";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

export default function CreateBid() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  // Customer selection state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Form state — all populated from selected customer, not freehand
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [notes, setNotes] = useState("");

  // Design visualization state
  const [designData, setDesignData] = useState(null);
  const [showDesignDialog, setShowDesignDialog] = useState(false);
  const [showDesignVisualizer, setShowDesignVisualizer] = useState(false);

  // AI Assistant state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const aiBottomRef = useRef(null);

  // Photo state
  const [bidPhotos, setBidPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // AI Concept Rendering state
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptProjectType, setConceptProjectType] = useState("Planter Bed");
  const [conceptWidth, setConceptWidth] = useState("");
  const [conceptLength, setConceptLength] = useState("");
  const [conceptUnit, setConceptUnit] = useState("ft");
  const [conceptStyle, setConceptStyle] = useState("Desert Modern");
  const [conceptFocalElements, setConceptFocalElements] = useState("");
  const [conceptSpecialNotes, setConceptSpecialNotes] = useState("");
  const [conceptUsePhotos, setConceptUsePhotos] = useState(true);
  const [conceptRendering, setConceptRendering] = useState(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);

  useEffect(() => {
    if (aiBottomRef.current) aiBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Compress image to max 800px and convert to base64 for AI vision
  const compressToBase64 = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // Compress and convert to base64 for AI vision (keeps payload small)
      const base64 = await compressToBase64(file);

      // Upload original to Firebase Storage for persistence
      const storage = getStorage();
      const storageRef = ref(storage, "bid-photos/" + Date.now() + "_" + file.name);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setBidPhotos(prev => [...prev, { url, name: file.name, base64 }]);
    } catch (err) {
      console.error("Photo upload error:", err);
      Swal.fire("Error", "Failed to upload photo.", "error");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput.trim() };
    const updatedMessages = [...aiMessages, userMsg];
    setAiMessages(updatedMessages);
    setAiInput("");
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const functions = getFunctions();
      const bidAssistant = httpsCallable(functions, "bidAssistant");
      // Pass base64 photos so the AI can see them
      const photoBase64List = bidPhotos.map(p => p.base64).filter(Boolean);
      // Clean message history — summarize suggestion JSON so history stays readable
      const cleanMessages = updatedMessages.map(msg => {
        if (msg.role === "assistant" && msg.isSuggestion) {
          try {
            const parsed = JSON.parse(msg.content);
            return { role: "assistant", content: "I suggested a bid of $" + parsed.recommendedAmount + " for: " + parsed.description };
          } catch { return { role: "assistant", content: msg.content }; }
        }
        return { role: msg.role, content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
      });
      const result = await bidAssistant({ messages: cleanMessages, photos: photoBase64List });
      const rawText = result.data?.text || "";
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.description && parsed.recommendedAmount) {
          setAiSuggestion(parsed);
          setAiMessages(prev => [...prev, { role: "assistant", content: rawText, isSuggestion: true }]);
        } else {
          setAiMessages(prev => [...prev, { role: "assistant", content: rawText }]);
        }
      } catch {
        setAiMessages(prev => [...prev, { role: "assistant", content: rawText }]);
      }
    } catch (err) {
      console.error("AI error:", err);
      setAiMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = (suggestion) => {
    const s = suggestion || aiSuggestion;
    if (!s) return;
    setDescription(s.description);
    setMaterials(s.materials);
    setAmount(String(s.recommendedAmount));

    // Build profit breakdown for notes
    const revenue = parseFloat(s.recommendedAmount) || 0;
    const laborCost = parseFloat(s.laborCost) || 0;
    const materialsCost = parseFloat(s.materialsCost) || 0;
    const totalCost = laborCost + materialsCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    const crewCost = (parseFloat(s.estimatedHours) || 0) * 15.15;
    const netProfit = revenue - materialsCost - crewCost;
    const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;

    const notesLines = [
      "--- AI Estimate Breakdown ---",
      "Est. Hours: " + s.estimatedHours + "h @ $60/hr billing rate",
      "Labor Cost (billing): $" + laborCost,
      "Materials Cost: ~$" + materialsCost,
      "Total Cost: $" + totalCost,
      "Bid Amount: $" + revenue,
      "Gross Profit: $" + profit.toFixed(0) + " (" + margin + "% margin)",
      "Net Profit (crew @ $15.15/hr): $" + netProfit.toFixed(0) + " (" + netMargin + "% net margin)",
      s.reasoning ? "AI Notes: " + s.reasoning : "",
    ].filter(Boolean);
    const notesBreakdown = notesLines.join("\n");

    setNotes(notesBreakdown);
    setAiOpen(false);
    Swal.fire({ icon: "success", title: "Applied to Bid!", text: "Description, materials, amount, and profit breakdown have been filled in.", timer: 2500, showConfirmButton: false });
  };

  const generateAiConcept = () => {
    if (!conceptFocalElements.trim()) {
      Swal.fire("Missing Info", "Please describe the focal elements or plants you want in the design.", "warning");
      return;
    }

    setGeneratingConcept(true);
    try {
      const dimStr =
        conceptWidth && conceptLength
          ? `${conceptWidth} ${conceptUnit} wide by ${conceptLength} ${conceptUnit} long`
          : "dimensions to be confirmed on site";

      const photoNote =
        conceptUsePhotos && bidPhotos.length > 0
          ? ` Reference the ${bidPhotos.length} uploaded site photo${bidPhotos.length > 1 ? "s" : ""} for existing conditions.`
          : "";

      const prompt =
        `Create a realistic ${conceptStyle.toLowerCase()} landscape rendering of a ` +
        `${dimStr} ${conceptProjectType.toLowerCase()}. ` +
        `${conceptFocalElements.trim()}` +
        `${conceptSpecialNotes.trim() ? ` Special notes: ${conceptSpecialNotes.trim()}.` : ""}` +
        `${photoNote} ` +
        `Style should be clean, upscale, and appropriate for an Arizona-style ` +
        `${conceptStyle.toLowerCase()} residential landscape. ` +
        `Present as a daytime photorealistic view.`;

      const elementList = conceptFocalElements
        .trim()
        .split(/[,\n]+/)
        .map((e) => e.trim())
        .filter(Boolean);

      const featuredSnippet =
        elementList.length > 0
          ? elementList.slice(0, 3).join(", ") + (elementList.length > 3 ? ", and more" : "")
          : "selected desert plants and hardscape";

      const summary =
        `This ${conceptStyle} ${conceptProjectType.toLowerCase()} design features ${featuredSnippet}. ` +
        `The ${dimStr} space will be transformed into a stunning, low-maintenance desert showcase ` +
        `that enhances curb appeal and property value.`;

      const concept = {
        projectType: conceptProjectType,
        dimensions: {
          width: conceptWidth,
          length: conceptLength,
          unit: conceptUnit,
        },
        stylePreset: conceptStyle,
        focalElements: conceptFocalElements,
        specialNotes: conceptSpecialNotes,
        usedPhotos: conceptUsePhotos && bidPhotos.length > 0,
        photoCount: conceptUsePhotos ? bidPhotos.length : 0,
        generatedPrompt: prompt,
        conceptSummary: summary,
        generatedAt: new Date().toISOString(),
      };

      setConceptRendering(concept);
      Swal.fire({
        icon: "success",
        title: "✨ Concept Brief Generated!",
        text: "Your AI concept brief is ready and will be included with this bid.",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Concept generation error:", err);
      Swal.fire("Error", "Failed to generate concept. Please try again.", "error");
    } finally {
      setGeneratingConcept(false);
    }
  };

  // Fetch customers for dropdown — only show customers with email AND address
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, "customers"));
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort by name
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setCustomers(data);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomers();
  }, []);

  // Handle customer selection
  const handleCustomerSelect = (event, value) => {
    setSelectedCustomer(value);
  };

  const handleContinueToSave = () => {
    // Gate 1 — must select an existing customer
    if (!selectedCustomer) {
      Swal.fire({
        icon: "warning",
        title: "Select a Customer First",
        html: `You must select an existing customer before creating a bid.<br/><br/>
               If this is a new customer, <strong>add them to the Customers list first</strong> 
               so their address, email, and contact info are on file.`,
        confirmButtonText: "Go to Customers",
        showCancelButton: true,
        cancelButtonText: "Stay Here",
      }).then((result) => {
        if (result.isConfirmed) navigate("/customers");
      });
      return;
    }

    // Gate 2 — customer must have an email address
    if (!selectedCustomer.email) {
      Swal.fire({
        icon: "warning",
        title: "Customer Missing Email",
        html: `<strong>${selectedCustomer.name}</strong> doesn't have an email address on file.<br/><br/>
               An email is required to send the bid for electronic signing.<br/><br/>
               Please update their customer record first.`,
        confirmButtonText: "Edit Customer",
        showCancelButton: true,
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) navigate(`/customer-edit/${selectedCustomer.id}`);
      });
      return;
    }

    // Gate 3 — customer must have an address
    if (!selectedCustomer.address) {
      Swal.fire({
        icon: "warning",
        title: "Customer Missing Address",
        html: `<strong>${selectedCustomer.name}</strong> doesn't have an address on file.<br/><br/>
               An address is required for scheduling and GPS check-in enforcement.<br/><br/>
               Please update their customer record first.`,
        confirmButtonText: "Edit Customer",
        showCancelButton: true,
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) navigate(`/customer-edit/${selectedCustomer.id}`);
      });
      return;
    }

    // Gate 4 — amount is required
    if (!amount) {
      Swal.fire("Missing Info", "Please enter a bid amount.", "warning");
      return;
    }

    // Gate 5 — description is required
    if (!description || !description.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Description Required",
        html: `Please describe the work to be done.<br/><br/>
               <small>This appears on the bid document and helps your crew know what the job is.</small>`,
        confirmButtonText: "OK",
      });
      return;
    }

    setShowDesignDialog(true);
  };

  const handleSkipDesign = () => {
    setShowDesignDialog(false);
    saveBidWithoutDesign();
  };

  const handleAddDesign = () => {
    setShowDesignDialog(false);
    setShowDesignVisualizer(true);
  };

  const handleDesignSaved = (design) => {
    setDesignData(design);
    setShowDesignVisualizer(false);
    saveBidWithDesign(design);
  };

  const handleCancelDesign = () => {
    setShowDesignVisualizer(false);
    setShowDesignDialog(true);
  };

  const saveBidWithoutDesign = async () => {
    try {
      await addDoc(collection(db, "bids"), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerEmail: selectedCustomer.email || "",
        customerPhone: selectedCustomer.phone || "",
        customerAddress: selectedCustomer.address || "",
        amount: parseFloat(amount),
        description: description || "",
        materials: materials || "",
        notes: notes || "",
        photos: bidPhotos.map(p => p.url),
        createdAt: new Date().toISOString(),
        hasDesignVisualization: false,
        hasAiConceptRendering: Boolean(conceptRendering),
        aiConceptRendering: conceptRendering || null,
        signingToken: generateSecureToken(),
      });

      await Swal.fire("✅ Bid saved", "Your bid was created.", "success");
      resetForm();
      navigate("/bids");
    } catch (err) {
      console.error("Error adding bid:", err);
      Swal.fire("Error", "Could not save the bid.", "error");
    }
  };

  const saveBidWithDesign = async (design) => {
    try {
      await addDoc(collection(db, "bids"), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerEmail: selectedCustomer.email || "",
        customerPhone: selectedCustomer.phone || "",
        customerAddress: selectedCustomer.address || "",
        amount: parseFloat(amount),
        description: description || "",
        materials: materials || "",
        notes: notes || "",
        photos: bidPhotos.map(p => p.url),
        createdAt: new Date().toISOString(),
        hasDesignVisualization: true,
        designVisualization: design,
        hasAiConceptRendering: Boolean(conceptRendering),
        aiConceptRendering: conceptRendering || null,
        signingToken: generateSecureToken(),
      });

      await Swal.fire("✅ Bid saved with design!", "Your bid with visualization was created.", "success");
      resetForm();
      navigate("/bids");
    } catch (err) {
      console.error("Error adding bid:", err);
      Swal.fire("Error", "Could not save the bid.", "error");
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setAmount("");
    setDescription("");
    setMaterials("");
    setNotes("");
    setDesignData(null);
    setConceptRendering(null);
    setConceptOpen(false);
    setConceptProjectType("Planter Bed");
    setConceptWidth("");
    setConceptLength("");
    setConceptUnit("ft");
    setConceptStyle("Desert Modern");
    setConceptFocalElements("");
    setConceptSpecialNotes("");
    setConceptUsePhotos(true);
  };

  if (showDesignVisualizer) {
    return (
      <DesignVisualizer
        customerName={selectedCustomer?.name || ""}
        onSave={handleDesignSaved}
        onCancel={handleCancelDesign}
      />
    );
  }

  return (
    <Container sx={{ mt: { xs: 2, sm: 4 }, pb: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography
            variant="h5"
            sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}
          >
            Create New Bid
          </Typography>
          <Tooltip title="AI Bid Assistant — describe the job and get instant suggestions">
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => setAiOpen(true)}
              sx={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                color: "white",
                fontWeight: 700,
                borderRadius: 2,
                boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
                "&:hover": { background: "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)" },
              }}
            >
              AI Assist
            </Button>
          </Tooltip>
        </Box>

        <Box>
          {/* Customer Selection — REQUIRED, no freehand entry */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Customer *
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Select an existing customer. If this is a new customer,{" "}
            <strong
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => navigate("/customer-edit/new")}
            >
              add them to Customers first
            </strong>
            .
          </Alert>

          <Autocomplete
            options={customers}
            getOptionLabel={(option) => `${option.name}${option.phone ? ` — ${option.phone}` : ""}`}
            value={selectedCustomer}
            onChange={handleCustomerSelect}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Customers *"
                helperText="Type a name or phone number to search"
                required
              />
            )}
            sx={{ mb: 2 }}
          />

          {/* Show customer info once selected */}
          {selectedCustomer && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                bgcolor: selectedCustomer.email && selectedCustomer.address ? "#e8f5e9" : "#fff8e1",
                border: "1px solid",
                borderColor: selectedCustomer.email && selectedCustomer.address ? "#a5d6a7" : "#ffe082",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {selectedCustomer.name}
              </Typography>
              {selectedCustomer.phone && (
                <Typography variant="body2">📞 {selectedCustomer.phone}</Typography>
              )}
              {selectedCustomer.address && (
                <Typography variant="body2">📍 {selectedCustomer.address}</Typography>
              )}
              {selectedCustomer.email ? (
                <Typography variant="body2">✉️ {selectedCustomer.email}</Typography>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <WarningAmberIcon color="warning" fontSize="small" />
                  <Typography variant="body2" color="warning.dark">
                    No email on file — required for signing.{" "}
                    <strong
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => navigate(`/customer-edit/${selectedCustomer.id}`)}
                    >
                      Edit Customer
                    </strong>
                  </Typography>
                </Box>
              )}
              {!selectedCustomer.address && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <WarningAmberIcon color="warning" fontSize="small" />
                  <Typography variant="body2" color="warning.dark">
                    No address on file — required for GPS scheduling.{" "}
                    <strong
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => navigate(`/customer-edit/${selectedCustomer.id}`)}
                    >
                      Edit Customer
                    </strong>
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* No customer selected — prompt to add one */}
          {!selectedCustomer && (
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => navigate("/customer-edit/new")}
              >
                Add New Customer
              </Button>
            </Box>
          )}

          {/* Bid Details */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
            Bid Details
          </Typography>

          <TextField
            label="Amount ($) *"
            type="number"
            fullWidth
            margin="normal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            label="Description"
            multiline
            rows={4}
            fullWidth
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the work to be done..."
            sx={{ mb: 2 }}
          />

          <TextField
            label="Materials"
            fullWidth
            margin="normal"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder="List materials needed..."
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes"
            multiline
            rows={2}
            fullWidth
            margin="normal"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes..."
            sx={{ mb: 3 }}
          />

          {/* ── Site Photos ── */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
              Site Photos (Optional)
            </Typography>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={photoInputRef}
              style={{ display: "none" }}
              onChange={handlePhotoUpload}
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => { if (photoInputRef.current) { photoInputRef.current.removeAttribute("capture"); photoInputRef.current.click(); } }}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Upload Photo
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => { if (photoInputRef.current) { photoInputRef.current.setAttribute("capture", "environment"); photoInputRef.current.click(); } }}
                disabled={uploadingPhoto}
              >
                Take Photo
              </Button>
            </Box>
            {bidPhotos.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {bidPhotos.map((photo, i) => (
                  <Box key={i} sx={{ position: "relative" }}>
                    <img src={photo.url} alt={"Site " + (i + 1)} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                    <IconButton
                      size="small"
                      onClick={() => setBidPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      sx={{ position: "absolute", top: -8, right: -8, bgcolor: "white", border: "1px solid #ddd", p: 0.25 }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* ── AI Concept Rendering ── */}
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 2,
                borderRadius: 2,
                cursor: "pointer",
                background: conceptRendering
                  ? "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)"
                  : "linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%)",
                border: "1px solid",
                borderColor: conceptRendering ? "#a5d6a7" : "#ce93d8",
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: 2 },
              }}
              onClick={() => setConceptOpen((prev) => !prev)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <LandscapeIcon sx={{ color: conceptRendering ? "#2e7d32" : "#7c3aed", fontSize: 28 }} />
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: conceptRendering ? "#2e7d32" : "#7c3aed", lineHeight: 1.2 }}
                  >
                    ✨ AI Concept Rendering{conceptRendering ? " ✅" : " (Optional)"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {conceptRendering
                      ? `${conceptRendering.stylePreset} · ${conceptRendering.projectType} — concept brief ready`
                      : "Generate a polished design concept to impress your client"}
                  </Typography>
                </Box>
              </Box>
              {conceptOpen ? (
                <ExpandLessIcon sx={{ color: "text.secondary" }} />
              ) : (
                <ExpandMoreIcon sx={{ color: "text.secondary" }} />
              )}
            </Box>

            <Collapse in={conceptOpen}>
              <Paper variant="outlined" sx={{ p: 2.5, mt: 1, borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Fill in the details below to generate a professional concept brief. This will be saved with
                  the bid and shown to your client on the signing page and PDF.
                </Typography>

                {/* Project Type */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Project Type</InputLabel>
                  <Select
                    value={conceptProjectType}
                    label="Project Type"
                    onChange={(e) => setConceptProjectType(e.target.value)}
                  >
                    {["Planter Bed", "Front Yard", "Backyard", "Side Yard", "Driveway Entry", "Pool Area", "Full Property", "Other"].map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Dimensions */}
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Dimensions (Optional)
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                  <TextField
                    label="Width"
                    type="number"
                    value={conceptWidth}
                    onChange={(e) => setConceptWidth(e.target.value)}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Length"
                    type="number"
                    value={conceptLength}
                    onChange={(e) => setConceptLength(e.target.value)}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <FormControl sx={{ minWidth: 80 }} size="small">
                    <InputLabel>Unit</InputLabel>
                    <Select
                      value={conceptUnit}
                      label="Unit"
                      onChange={(e) => setConceptUnit(e.target.value)}
                    >
                      <MenuItem value="ft">ft</MenuItem>
                      <MenuItem value="in">in</MenuItem>
                      <MenuItem value="m">m</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Style Preset */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Style / Vibe</InputLabel>
                  <Select
                    value={conceptStyle}
                    label="Style / Vibe"
                    onChange={(e) => setConceptStyle(e.target.value)}
                  >
                    {[
                      "Desert Modern",
                      "Xeriscape Low Maintenance",
                      "Desert Oasis",
                      "HOA Clean Look",
                      "Rock & Cactus Garden",
                      "Desert Tropical Mix",
                      "Southwestern Traditional",
                      "Contemporary Minimalist",
                    ].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Focal Elements */}
                <TextField
                  label="Focal Elements / Plants / Hardscape *"
                  multiline
                  rows={3}
                  fullWidth
                  value={conceptFocalElements}
                  onChange={(e) => setConceptFocalElements(e.target.value)}
                  placeholder="e.g., 3 standing saguaro cactus, multiple barrel cactus, 1 large boulder at far end, desert mocha rock ground cover..."
                  sx={{ mb: 2 }}
                />

                {/* Special Placement Notes */}
                <TextField
                  label="Special Placement Notes"
                  multiline
                  rows={2}
                  fullWidth
                  value={conceptSpecialNotes}
                  onChange={(e) => setConceptSpecialNotes(e.target.value)}
                  placeholder="e.g., boulder near the closed end, spacing for HOA clearance, no plants within 3ft of wall..."
                  sx={{ mb: 2 }}
                />

                {/* Use Photos Toggle */}
                {bidPhotos.length > 0 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={conceptUsePhotos}
                        onChange={(e) => setConceptUsePhotos(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={`Reference uploaded site photos (${bidPhotos.length} photo${bidPhotos.length > 1 ? "s" : ""})`}
                    sx={{ mb: 2, display: "block" }}
                  />
                )}

                {/* Generate Button */}
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={generateAiConcept}
                  disabled={generatingConcept}
                  startIcon={
                    generatingConcept ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <AutoAwesomeIcon />
                    )
                  }
                  sx={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    color: "white",
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1.5,
                    boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)",
                    },
                  }}
                >
                  {generatingConcept ? "Generating Concept…" : "✨ Generate AI Concept Brief"}
                </Button>

                {/* Concept Result Preview */}
                {conceptRendering && (
                  <Box sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
                        border: "1px solid #a5d6a7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                        <CheckCircleIcon sx={{ color: "#2e7d32" }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#2e7d32" }}>
                          Concept Brief Ready
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                        <Chip label={conceptRendering.stylePreset} size="small" color="primary" variant="outlined" />
                        <Chip label={conceptRendering.projectType} size="small" variant="outlined" />
                        {conceptRendering.dimensions.width && conceptRendering.dimensions.length && (
                          <Chip
                            label={`${conceptRendering.dimensions.width} × ${conceptRendering.dimensions.length} ${conceptRendering.dimensions.unit}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {conceptRendering.usedPhotos && (
                          <Chip
                            label={`${conceptRendering.photoCount} photo ref`}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ mb: 1, fontStyle: "italic", color: "text.secondary" }}>
                        {conceptRendering.conceptSummary}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ✅ Will be saved with the bid and shown to your client
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Collapse>
          </Box>

          <Button
            variant="contained"
            color="success"
            onClick={handleContinueToSave}
            fullWidth
            size="large"
            sx={{ py: 1.5, fontSize: { xs: "1rem", sm: "1.1rem" } }}
          >
            Continue to Save
          </Button>
        </Box>
      </Paper>

      {/* Design Dialog */}
      <Dialog
        open={showDesignDialog}
        onClose={() => setShowDesignDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          🎨 Add Design Visualization?
        </DialogTitle>
        <DialogContent>
          <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <BrushIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
                <Typography variant="h6">
                  Show Your Customer What They're Getting!
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Add a visual design overlay to your bid using our Design Visualizer.
                Upload a photo of the customer's property and sketch out the plan.
              </Typography>
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? "column" : "row", p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={handleSkipDesign}
            fullWidth={isMobile}
          >
            Skip — Save Bid Without Design
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddDesign}
            startIcon={<BrushIcon />}
            fullWidth={isMobile}
          >
            Add Design Visualization
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════
          AI BID ASSISTANT DRAWER
      ═══════════════════════════════════════ */}
      <Drawer
        anchor="right"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" } }}
      >
        {/* Header */}
        <Box sx={{ p: 2, background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>✨ AI Bid Assistant</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {bidPhotos.length > 0
                ? `${bidPhotos.length} photo${bidPhotos.length > 1 ? "s" : ""} attached — AI can see them`
                : "Describe the job — I'll suggest pricing & scope"}
            </Typography>
          </Box>
          <IconButton onClick={() => setAiOpen(false)} sx={{ color: "white" }}><CloseIcon /></IconButton>
        </Box>

        {/* Starter chips */}
        {aiMessages.length === 0 && (
          <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>Try one of these:</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[
                "Front yard weed cleanup, about 1500 sq ft",
                "Install decomposed granite, 2 car driveway",
                "Fix broken irrigation, 3 heads not working",
                "Trim 6 trees and haul away debris",
              ].map(prompt => (
                <Chip
                  key={prompt}
                  label={prompt}
                  size="small"
                  onClick={() => setAiInput(prompt)}
                  sx={{ cursor: "pointer", fontSize: "0.7rem", "&:hover": { bgcolor: "#ede9fe" } }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          {aiMessages.length === 0 && (
            <Box sx={{ textAlign: "center", mt: 4, color: "text.secondary" }}>
              <AutoAwesomeIcon sx={{ fontSize: 48, color: "#7c3aed", opacity: 0.4, mb: 1 }} />
              <Typography variant="body2">Describe the job in plain English and I'll suggest a professional scope, materials list, and bid amount.</Typography>
            </Box>
          )}
          {aiMessages.map((msg, i) => {
            const isUser = msg.role === "user";
            let suggestion = null;
            if (!isUser && msg.isSuggestion) {
              try { suggestion = JSON.parse(msg.content); } catch {}
            }
            return (
              <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <Box sx={{
                  maxWidth: "90%",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isUser ? "#4f46e5" : "#f5f5f5",
                  color: isUser ? "white" : "text.primary",
                }}>
                  {suggestion ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>📋 Scope of Work</Typography>
                      <Typography variant="body2" sx={{ mb: 1.5 }}>{suggestion.description}</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>🧱 Materials</Typography>
                      <Typography variant="body2" sx={{ mb: 1.5 }}>{suggestion.materials}</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
                        <Chip label={`${suggestion.estimatedHours}h labor`} size="small" color="default" />
                        <Chip label={`$${suggestion.laborCost} labor cost`} size="small" color="default" />
                        <Chip label={`~$${suggestion.materialsCost} materials`} size="small" color="default" />
                      </Box>
                      <Box sx={{ p: 1.5, bgcolor: "#e8f5e9", borderRadius: 1, mb: 1.5, textAlign: "center" }}>
                        <Typography variant="h6" color="success.dark" fontWeight={800}>✅ Recommended Bid: ${suggestion.recommendedAmount}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>💡 {suggestion.reasoning}</Typography>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<CheckCircleIcon />}
                        onClick={() => applyAiSuggestion(suggestion)}
                        sx={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", fontWeight: 700 }}
                      >
                        Apply to Bid
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{msg.content}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}
          {aiLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} sx={{ color: "#7c3aed" }} />
              <Typography variant="caption" color="text.secondary">Analyzing job...</Typography>
            </Box>
          )}
          <div ref={aiBottomRef} />
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: "1px solid #e0e0e0", display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Describe the job (size, type, condition)..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }}}
            multiline
            maxRows={3}
          />
          <IconButton
            onClick={sendAiMessage}
            disabled={!aiInput.trim() || aiLoading}
            sx={{ bgcolor: "#7c3aed", color: "white", borderRadius: 2, "&:hover": { bgcolor: "#6d28d9" }, "&:disabled": { bgcolor: "#e0e0e0" } }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Drawer>
    </Container>
  );
}