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
  MenuItem,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Swal from "sweetalert2";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import BuildIcon from "@mui/icons-material/Build";

const EQUIPMENT_TYPES = [
  "Concrete Pump Truck",
  "Dump Truck",
  "Excavator",
  "Skid Steer",
  "Compactor",
  "Concrete Mixer",
  "Generator",
  "Air Compressor",
  "Forklift",
  "Trailer",
  "Other",
];

export default function EquipmentManager() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
  const [equipment, setEquipment] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    status: "available",
    dailyRate: "",
    notes: "",
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const snap = await getDocs(collection(db, "equipment"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(data);
    } catch (error) {
      console.error("Error fetching equipment:", error);
    }
  };

  const handleOpenDialog = (equip = null) => {
    if (equip) {
      setEditingEquipment(equip);
      setFormData({
        name: equip.name || "",
        type: equip.type || "",
        description: equip.description || "",
        status: equip.status || "available",
        dailyRate: equip.dailyRate || "",
        notes: equip.notes || "",
      });
    } else {
      setEditingEquipment(null);
      setFormData({
        name: "",
        type: "",
        description: "",
        status: "available",
        dailyRate: "",
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEquipment(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.type) {
      Swal.fire("Missing Info", "Equipment name and type are required", "warning");
      return;
    }

    try {
      if (editingEquipment) {
        await updateDoc(doc(db, "equipment", editingEquipment.id), formData);
        Swal.fire("Updated!", "Equipment updated successfully", "success");
      } else {
        await addDoc(collection(db, "equipment"), {
          ...formData,
          createdAt: new Date().toISOString(),
        });
        Swal.fire("Added!", "New equipment added successfully", "success");
      }
      fetchEquipment();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving equipment:", error);
      Swal.fire("Error", "Failed to save equipment", "error");
    }
  };

  const handleDelete = async (equip) => {
    const result = await Swal.fire({
      title: `Delete ${equip.name}?`,
      text: "This will remove it from your equipment list",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "equipment", equip.id));
        setEquipment(equipment.filter((e) => e.id !== equip.id));
        Swal.fire("Deleted!", "Equipment removed", "success");
      } catch (error) {
        console.error("Error deleting equipment:", error);
        Swal.fire("Error", "Failed to delete equipment", "error");
      }
    }
  };

  const updateStatus = async (equip, newStatus) => {
    try {
      await updateDoc(doc(db, "equipment", equip.id), { status: newStatus });
      setEquipment(equipment.map((e) => 
        e.id === equip.id ? { ...e, status: newStatus } : e
      ));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "available": return "success";
      case "in-use": return "warning";
      case "maintenance": return "error";
      default: return "default";
    }
  };

  return (
    <Container sx={{ mt: 3, mb: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          🚛 Equipment Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          size={isMobile ? "small" : "medium"}
        >
          {isMobile ? "Add" : "Add Equipment"}
        </Button>
      </Box>

      <Grid container spacing={2}>
        {equipment.map((equip) => (
          <Grid item xs={12} sm={6} md={4} key={equip.id}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {equip.type?.includes("Truck") ? (
                      <LocalShippingIcon color="primary" />
                    ) : (
                      <BuildIcon color="primary" />
                    )}
                    <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                      {equip.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={equip.status || "available"}
                    color={getStatusColor(equip.status)}
                    size="small"
                    onClick={() => {
                      const statuses = ["available", "in-use", "maintenance"];
                      const currentIndex = statuses.indexOf(equip.status || "available");
                      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                      updateStatus(equip, nextStatus);
                    }}
                    sx={{ cursor: "pointer", textTransform: "capitalize" }}
                  />
                </Box>

                <Typography variant="body2" color="primary" sx={{ mb: 1, fontWeight: "bold" }}>
                  {equip.type}
                </Typography>

                {equip.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {equip.description}
                  </Typography>
                )}

                {equip.dailyRate && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Daily Rate:</strong> ${equip.dailyRate}/day
                  </Typography>
                )}

                {equip.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
                    {equip.notes}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ justifyContent: "flex-end", p: 2, pt: 0 }}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleOpenDialog(equip)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(equip)}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {equipment.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: "center", py: 8 }}>
              <LocalShippingIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No Equipment Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add your equipment to track availability and scheduling
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Equipment
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
          {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Equipment Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Pump Truck #1, Excavator"
              fullWidth
              required
            />

            <TextField
              select
              label="Type *"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              fullWidth
              required
            >
              {EQUIPMENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Make, model, year, specs, etc."
              fullWidth
            />

            <TextField
              select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="in-use">In Use</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
            </TextField>

            <TextField
              label="Daily Rate ($)"
              type="number"
              value={formData.dailyRate}
              onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
              inputProps={{ min: 0, step: "0.01" }}
              helperText="Cost per day (for internal tracking)"
              fullWidth
            />

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              placeholder="Maintenance schedule, usage notes, etc."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingEquipment ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}