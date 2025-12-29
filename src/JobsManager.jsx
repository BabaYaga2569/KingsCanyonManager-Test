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
import { useNavigate } from "react-router-dom";  // ← NEW
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
import Swal from "sweetalert2";

export default function JobsManager() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [photoType, setPhotoType] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Edit dialog state
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
  
  const navigate = useNavigate();  // ← NEW
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobs();
  }, []);

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
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it",
    });

    if (confirm.isConfirmed) {
      try {
        await deleteDoc(doc(db, "jobs", jobId));
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        Swal.fire("Deleted!", "The job has been removed.", "success");
      } catch (error) {
        console.error("Error deleting job:", error);
        Swal.fire("Error", "Failed to delete job.", "error");
      }
    }
  };

  const handleOpenCamera = async (type, job) => {
    setPhotoType(type);
    setCurrentJob(job);
    setCameraOpen(true);
    setCapturedImage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera access error:", error);
      Swal.fire({
        icon: "error",
        title: "Camera Access Denied",
        text: "Please allow camera access to take photos. You can also upload from your gallery.",
      });
      setCameraOpen(false);
    }
  };

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageDataUrl);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target.result);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!capturedImage || !currentJob) return;

    setUploading(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const timestamp = Date.now();
      const filename = `jobs/${currentJob.id}/${photoType}_${timestamp}.jpg`;
      
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      
      const downloadURL = await getDownloadURL(storageRef);
      
      const jobRef = doc(db, "jobs", currentJob.id);
      const photoField = `${photoType}Photos`;
      const currentPhotos = currentJob[photoField] || [];
      
      await updateDoc(jobRef, {
        [photoField]: [...currentPhotos, downloadURL],
      });
      
      setJobs(prev => prev.map(job => 
        job.id === currentJob.id 
          ? { ...job, [photoField]: [...currentPhotos, downloadURL] }
          : job
      ));
      
      Swal.fire({
        icon: "success",
        title: "Photo Uploaded!",
        text: `${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo saved successfully.`,
        timer: 2000,
      });
      
      handleCloseCamera();
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: "Failed to upload photo. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraOpen(false);
    setCapturedImage(null);
    setCurrentJob(null);
  };

  // NEW: View photos gallery
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

  // Edit job functions
  const handleOpenEditDialog = (job) => {
    setEditingJob(job);
    setEditForm({
      clientName: job.clientName || "",
      description: job.description || "",
      amount: job.amount || "",
      status: job.status || "Pending",
      startDate: job.startDate || "",
      completionDate: job.completionDate || "",
      notes: job.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingJob(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm.clientName) {
      Swal.fire("Missing Info", "Client name is required", "warning");
      return;
    }

    try {
      await updateDoc(doc(db, "jobs", editingJob.id), {
        clientName: editForm.clientName,
        description: editForm.description,
        amount: editForm.amount ? parseFloat(editForm.amount) : 0,
        status: editForm.status,
        startDate: editForm.startDate,
        completionDate: editForm.completionDate,
        notes: editForm.notes,
        lastUpdated: new Date().toISOString(),
      });

      setJobs((prev) =>
        prev.map((job) =>
          job.id === editingJob.id
            ? { ...job, ...editForm, amount: editForm.amount ? parseFloat(editForm.amount) : 0 }
            : job
        )
      );

      Swal.fire("Saved!", "Job updated successfully.", "success");
      handleCloseEditDialog();
    } catch (error) {
      console.error("Error updating job:", error);
      Swal.fire("Error", "Failed to update job.", "error");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "error";
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
      <Typography 
        variant="h6" 
        gutterBottom
        sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
      >
        Jobs (Before / After Photos)
      </Typography>

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
        {jobs.map((job) => (
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
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
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
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}