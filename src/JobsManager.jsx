import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import EditIcon from "@mui/icons-material/Edit";
import SortIcon from "@mui/icons-material/Sort";
import Swal from "sweetalert2";
import { markAsViewed } from './useNotificationCounts';

export default function JobsManager() {
  const [jobs, setJobs] = useState([]);
  const [sortedJobs, setSortedJobs] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [photoType, setPhotoType] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({
    clientName: "",
    description: "",
    amount: "",
    status: "",
    startDate: "",
    completionDate: "",
    notes: "",
  });
  
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobs();
  }, []);
  useEffect(() => {
    markAsViewed('jobs');
  }, []);  

  // Sort jobs whenever jobs or sortOrder changes
  useEffect(() => {
    const sorted = [...jobs].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.createdAt || b.startDate || 0) - new Date(a.createdAt || a.startDate || 0);
        case "oldest":
          return new Date(a.createdAt || a.startDate || 0) - new Date(b.createdAt || b.startDate || 0);
        case "name-asc":
          return (a.clientName || "").localeCompare(b.clientName || "");
        case "name-desc":
          return (b.clientName || "").localeCompare(a.clientName || "");
        case "status-active":
          return (a.status === "Active" ? -1 : 1) - (b.status === "Active" ? -1 : 1);
        case "status-completed":
          return (a.status === "Completed" ? -1 : 1) - (b.status === "Completed" ? -1 : 1);
        case "status-pending":
          return (a.status === "Pending" ? -1 : 1) - (b.status === "Pending" ? -1 : 1);
        default:
          return 0;
      }
    });
    setSortedJobs(sorted);
  }, [jobs, sortOrder]);

  const fetchJobs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "jobs"));
      const jobList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setJobs(jobList);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await updateDoc(doc(db, "jobs", jobId), { status: newStatus });
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDeleteJob = async (jobId, clientName) => {
    const confirm = await Swal.fire({
      title: `Delete ${clientName}'s job?`,
      text: "This will permanently remove this job and all its photos.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "jobs", jobId));
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      Swal.fire("Deleted!", "Job has been removed.", "success");
    } catch (error) {
      console.error("Error deleting job:", error);
      Swal.fire("Error", "Failed to delete job.", "error");
    }
  };

  // View photos gallery
  const handleViewPhotos = (job) => {
    const beforePhotos = job.beforePhotos || [];
    const afterPhotos = job.afterPhotos || [];
    
    if (beforePhotos.length === 0 && afterPhotos.length === 0) {
      Swal.fire("No Photos", "This job has no photos yet.", "info");
      return;
    }

    const photoHTML = `
      <div style="max-height: 500px; overflow-y: auto; padding: 10px;">
        ${beforePhotos.length > 0 ? '<h3 style="color: #1976d2;">Before Photos:</h3>' : ''}
        ${beforePhotos.map((url, i) => `
          <div style="margin: 15px 0;">
            <p style="font-weight: bold;">Before Photo ${i+1}</p>
            <img src="${url}" 
                 style="width: 100%; max-width: 400px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                 onclick="window.open('${url}', '_blank')" />
          </div>
        `).join('')}
        
        ${afterPhotos.length > 0 ? '<h3 style="color: #2e7d32; margin-top: 20px;">After Photos:</h3>' : ''}
        ${afterPhotos.map((url, i) => `
          <div style="margin: 15px 0;">
            <p style="font-weight: bold;">After Photo ${i+1}</p>
            <img src="${url}" 
                 style="width: 100%; max-width: 400px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                 onclick="window.open('${url}', '_blank')" />
          </div>
        `).join('')}
      </div>
      <p style="margin-top: 20px; font-size: 14px; color: #666; text-align: center;">
        📸 Tap any photo to view full size
      </p>
    `;

    Swal.fire({
      title: `${job.clientName} - Photos`,
      html: photoHTML,
      width: '90%',
      showCloseButton: true,
      showConfirmButton: false,
    });
  };

  const handleOpenEditDialog = (job) => {
    setEditingJob(job);
    setEditForm({
      clientName: job.clientName || "",
      description: job.description || "",
      amount: job.amount || "",
      status: job.status || "",
      startDate: job.startDate || "",
      completionDate: job.completionDate || "",
      notes: job.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingJob(null);
    setEditForm({
      clientName: "",
      description: "",
      amount: "",
      status: "",
      startDate: "",
      completionDate: "",
      notes: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;

    try {
      await updateDoc(doc(db, "jobs", editingJob.id), editForm);
      setJobs((prev) =>
        prev.map((job) =>
          job.id === editingJob.id ? { ...job, ...editForm } : job
        )
      );
      Swal.fire("Updated!", "Job details have been saved.", "success");
      handleCloseEditDialog();
    } catch (error) {
      console.error("Error updating job:", error);
      Swal.fire("Error", "Failed to update job.", "error");
    }
  };

  const handleOpenCamera = async (type, job) => {
    setCurrentJob(job);
    setPhotoType(type);
    setCapturedImage(null);
    setCameraOpen(true);
  };

  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCurrentJob(null);
    setPhotoType("");
    setCapturedImage(null);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      Swal.fire("Error", "Could not access camera.", "error");
      handleCloseCamera();
    }
  };

  useEffect(() => {
    if (cameraOpen && videoRef.current) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraOpen]);

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = async () => {
    if (!capturedImage || !currentJob) return;

    setUploading(true);
    try {
      const blob = await (await fetch(capturedImage)).blob();
      const fileName = `${currentJob.id}_${photoType}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `job-photos/${fileName}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const field =
        photoType === "before" ? "beforePhotos" : "afterPhotos";
      const currentPhotos = currentJob[field] || [];
      const updatedPhotos = [...currentPhotos, url];

      await updateDoc(doc(db, "jobs", currentJob.id), {
        [field]: updatedPhotos,
      });

      setJobs((prev) =>
        prev.map((job) =>
          job.id === currentJob.id
            ? { ...job, [field]: updatedPhotos }
            : job
        )
      );

      Swal.fire("Success!", "Photo uploaded.", "success");
      handleCloseCamera();
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire("Error", "Failed to upload photo.", "error");
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "completed":
        return "info";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Typography sx={{ mt: 4, textAlign: "center" }}>
        Loading jobs...
      </Typography>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header with Sort Dropdown */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Jobs ({sortedJobs.length})
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
            <MenuItem value="name-asc">🔤 Name (A-Z)</MenuItem>
            <MenuItem value="name-desc">🔤 Name (Z-A)</MenuItem>
            <MenuItem value="status-active">🔄 Active First</MenuItem>
            <MenuItem value="status-completed">✅ Completed First</MenuItem>
            <MenuItem value="status-pending">⏳ Pending First</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { 
            xs: "1fr", 
            sm: "repeat(auto-fit, minmax(300px, 1fr))" 
          },
          gap: { xs: 2, sm: 3 },
          mt: 2,
        }}
      >
        {sortedJobs.map((job) => (
          <Card key={job.id} sx={{ boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                  {job.clientName}
                </Typography>
                <Chip
                  label={job.status || "Pending"}
                  color={getStatusColor(job.status)}
                  size="small"
                />
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel size="small">Change Status</InputLabel>
                <Select
                  size="small"
                  value={job.status || "Pending"}
                  label="Change Status"
                  onChange={(e) =>
                    handleStatusChange(job.id, e.target.value)
                  }
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>

              {job.notes && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Job Notes"
                  value={job.notes || ""}
                  disabled
                  size="small"
                  sx={{ mb: 2 }}
                />
              )}

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip 
                  icon={<PhotoLibraryIcon />}
                  label={`Before: ${(job.beforePhotos || []).length}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip 
                  icon={<PhotoLibraryIcon />}
                  label={`After: ${(job.afterPhotos || []).length}`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </Box>
            </CardContent>

            <CardActions sx={{ p: 2, pt: 0, flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => handleOpenEditDialog(job)}
                fullWidth
                size="small"
              >
                ✏️ Edit Job
              </Button>

              <Button
                variant="outlined"
                startIcon={<CameraAltIcon />}
                onClick={() => handleOpenCamera("before", job)}
                fullWidth
                size="small"
              >
                📷 Take Before Photo
              </Button>

              <Button
                variant="outlined"
                color="success"
                startIcon={<CameraAltIcon />}
                onClick={() => handleOpenCamera("after", job)}
                fullWidth
                size="small"
              >
                📷 Take After Photo
              </Button>

              <Button
                variant="contained"
                color="info"
                onClick={() => handleViewPhotos(job)}
                fullWidth
                size="small"
              >
                📷 View All Photos ({(job.beforePhotos || []).length + (job.afterPhotos || []).length})
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(`/job-expenses/${job.id}`)}
                fullWidth
                size="small"
              >
                💰 View Expenses & Profit
              </Button>

              <Button
                variant="outlined"
                color="error"
                onClick={() => handleDeleteJob(job.id, job.clientName)}
                fullWidth
                size="small"
              >
                Delete Job
              </Button>
            </CardActions>
          </Card>
        ))}

        {sortedJobs.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No Jobs Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Jobs will appear here after you create them
            </Typography>
          </Box>
        )}
      </Box>

      {/* Camera Dialog */}
      <Dialog 
        open={cameraOpen} 
        onClose={handleCloseCamera}
        maxWidth="sm"
        fullWidth
        fullScreen={window.innerWidth < 600}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {photoType.charAt(0).toUpperCase() + photoType.slice(1)} Photo
          </Typography>
          <IconButton onClick={handleCloseCamera}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {!capturedImage ? (
            <Box sx={{ textAlign: 'center' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  backgroundColor: '#000',
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleCapturePhoto}
                  fullWidth
                  size="large"
                >
                  📸 Capture Photo
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  fullWidth
                >
                  📁 Upload from Gallery
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={capturedImage}
                alt="Captured"
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  objectFit: 'contain',
                }}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          {capturedImage ? (
            <>
              <Button 
                onClick={() => setCapturedImage(null)}
                variant="outlined"
              >
                Retake
              </Button>
              <Button
                onClick={handleUploadPhoto}
                disabled={uploading}
                variant="contained"
                color="success"
              >
                {uploading ? "Uploading..." : "Save Photo"}
              </Button>
            </>
          ) : (
            <Button onClick={handleCloseCamera}>
              Cancel
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>✏️ Edit Job</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Client Name *"
              value={editForm.clientName}
              onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Description"
              multiline
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Amount ($)"
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              fullWidth
              inputProps={{ min: 0, step: "0.01" }}
            />
            
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.status}
                label="Status"
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Start Date"
              type="date"
              value={editForm.startDate}
              onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              label="Completion Date"
              type="date"
              value={editForm.completionDate}
              onChange={(e) => setEditForm({ ...editForm, completionDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            💾 Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}