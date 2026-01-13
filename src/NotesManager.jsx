import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Paper,
  Grid,
  useMediaQuery,
  useTheme,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import WorkIcon from "@mui/icons-material/Work";
import LabelIcon from "@mui/icons-material/Label";
import Swal from "sweetalert2";
import moment from "moment";

export default function NotesManager() {
  const [notes, setNotes] = useState([]);
  const [sortedNotes, setSortedNotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJob, setFilterJob] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    jobId: "",
    jobName: "",
    tags: "",
    priority: "medium",
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch notes
      const notesSnap = await getDocs(collection(db, "notes"));
      const notesData = notesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Fetch jobs for linking
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const jobsData = jobsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setNotes(notesData);
      setJobs(jobsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      Swal.fire("Error", "Failed to load notes.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort notes
  useEffect(() => {
    let filtered = [...notes];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (note) =>
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.tags?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Job filter
    if (filterJob !== "all") {
      filtered = filtered.filter((note) => note.jobId === filterJob);
    }

    // Priority filter
    if (filterPriority !== "all") {
      filtered = filtered.filter((note) => note.priority === filterPriority);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return (
            new Date(b.createdAt?.seconds * 1000 || 0) -
            new Date(a.createdAt?.seconds * 1000 || 0)
          );
        case "oldest":
          return (
            new Date(a.createdAt?.seconds * 1000 || 0) -
            new Date(b.createdAt?.seconds * 1000 || 0)
          );
        case "title-asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title-desc":
          return (b.title || "").localeCompare(a.title || "");
        case "priority-high":
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return (
            (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1)
          );
        case "priority-low":
          const priorityOrderRev = { high: 2, medium: 1, low: 0 };
          return (
            (priorityOrderRev[a.priority] || 1) -
            (priorityOrderRev[b.priority] || 1)
          );
        default:
          return 0;
      }
    });

    setSortedNotes(sorted);
  }, [notes, searchQuery, filterJob, filterPriority, sortOrder]);

  const handleOpenDialog = (note = null) => {
    if (note) {
      setEditingNote(note);
      setNoteForm({
        title: note.title || "",
        content: note.content || "",
        jobId: note.jobId || "",
        jobName: note.jobName || "",
        tags: note.tags || "",
        priority: note.priority || "medium",
      });
    } else {
      setEditingNote(null);
      setNoteForm({
        title: "",
        content: "",
        jobId: "",
        jobName: "",
        tags: "",
        priority: "medium",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingNote(null);
    setNoteForm({
      title: "",
      content: "",
      jobId: "",
      jobName: "",
      tags: "",
      priority: "medium",
    });
  };

  const handleSaveNote = async () => {
    if (!noteForm.title.trim()) {
      Swal.fire("Error", "Please enter a title for the note.", "warning");
      return;
    }

    try {
      const noteData = {
        ...noteForm,
        updatedAt: Timestamp.now(),
      };

      if (editingNote) {
        // Update existing note
        await updateDoc(doc(db, "notes", editingNote.id), noteData);
        setNotes((prev) =>
          prev.map((n) => (n.id === editingNote.id ? { ...n, ...noteData } : n))
        );
        Swal.fire("Updated!", "Note has been updated.", "success");
      } else {
        // Create new note
        noteData.createdAt = Timestamp.now();
        const docRef = await addDoc(collection(db, "notes"), noteData);
        setNotes((prev) => [...prev, { id: docRef.id, ...noteData }]);
        Swal.fire("Created!", "Note has been created.", "success");
      }

      handleCloseDialog();
    } catch (error) {
      console.error("Error saving note:", error);
      Swal.fire("Error", "Failed to save note.", "error");
    }
  };

  const handleDeleteNote = async (id, title) => {
    const confirm = await Swal.fire({
      title: "Delete Note?",
      text: `Are you sure you want to delete "${title}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "notes", id));
      setNotes((prev) => prev.filter((n) => n.id !== id));
      Swal.fire("Deleted!", "Note has been deleted.", "success");
    } catch (error) {
      console.error("Error deleting note:", error);
      Swal.fire("Error", "Failed to delete note.", "error");
    }
  };

  const handleJobChange = (jobId) => {
    const selectedJob = jobs.find((j) => j.id === jobId);
    setNoteForm({
      ...noteForm,
      jobId: jobId,
      jobName: selectedJob ? selectedJob.clientName : "",
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "default";
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case "high":
        return "🔴 High";
      case "medium":
        return "🟡 Medium";
      case "low":
        return "🟢 Low";
      default:
        return priority;
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography>Loading notes...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          📝 Notes ({sortedNotes.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          New Note
        </Button>
        <Button
          variant="contained"
          onClick={() => handleOpenDialog()}
          sx={{ display: { xs: "inline-flex", sm: "none" } }}
        >
          <AddIcon />
        </Button>
      </Box>

      {/* Filters & Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Job</InputLabel>
              <Select
                value={filterJob}
                label="Filter by Job"
                onChange={(e) => setFilterJob(e.target.value)}
              >
                <MenuItem value="all">All Jobs</MenuItem>
                <MenuItem value="">No Job</MenuItem>
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.clientName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={filterPriority}
                label="Priority"
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <MenuItem value="all">All Priorities</MenuItem>
                <MenuItem value="high">🔴 High</MenuItem>
                <MenuItem value="medium">🟡 Medium</MenuItem>
                <MenuItem value="low">🟢 Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>
                <SortIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                Sort By
              </InputLabel>
              <Select
                value={sortOrder}
                label="Sort By"
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <MenuItem value="newest">📅 Newest First</MenuItem>
                <MenuItem value="oldest">📅 Oldest First</MenuItem>
                <MenuItem value="title-asc">🔤 Title (A-Z)</MenuItem>
                <MenuItem value="title-desc">🔤 Title (Z-A)</MenuItem>
                <MenuItem value="priority-high">🔴 High Priority First</MenuItem>
                <MenuItem value="priority-low">🟢 Low Priority First</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setSearchQuery("");
                setFilterJob("all");
                setFilterPriority("all");
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Notes Grid */}
      {sortedNotes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Notes Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || filterJob !== "all" || filterPriority !== "all"
              ? "No notes match your filters."
              : "Click 'New Note' to create your first note."}
          </Typography>
          {!searchQuery && filterJob === "all" && filterPriority === "all" && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Create First Note
            </Button>
          )}
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(auto-fill, minmax(300px, 1fr))",
            },
            gap: 2,
          }}
        >
          {sortedNotes.map((note) => (
            <Card key={note.id} sx={{ boxShadow: 2, display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    mb: 1,
                  }}
                >
                  <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
                    {note.title}
                  </Typography>
                  <Chip
                    label={getPriorityLabel(note.priority)}
                    color={getPriorityColor(note.priority)}
                    size="small"
                  />
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "60px",
                  }}
                >
                  {note.content || "No content"}
                </Typography>

                {note.jobName && (
                  <Chip
                    icon={<WorkIcon />}
                    label={note.jobName}
                    size="small"
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                )}

                {note.tags && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                    {note.tags.split(",").map((tag, idx) => (
                      <Chip
                        key={idx}
                        icon={<LabelIcon />}
                        label={tag.trim()}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    ))}
                  </Box>
                )}

                <Typography variant="caption" color="text.secondary">
                  {note.createdAt
                    ? moment(note.createdAt.seconds * 1000).format("MMM DD, YYYY h:mm A")
                    : "Unknown date"}
                </Typography>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenDialog(note)}
                  fullWidth
                  variant="outlined"
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteNote(note.id, note.title)}
                  fullWidth
                  variant="outlined"
                  color="error"
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingNote ? "✏️ Edit Note" : "➕ New Note"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Title *"
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
              fullWidth
              autoFocus
            />

            <TextField
              label="Content"
              value={noteForm.content}
              onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              fullWidth
              multiline
              rows={6}
              placeholder="Enter your note here..."
            />

            <FormControl fullWidth>
              <InputLabel>Link to Job (Optional)</InputLabel>
              <Select
                value={noteForm.jobId}
                label="Link to Job (Optional)"
                onChange={(e) => handleJobChange(e.target.value)}
              >
                <MenuItem value="">No Job</MenuItem>
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.clientName} - {job.status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Tags (comma-separated)"
              value={noteForm.tags}
              onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
              fullWidth
              placeholder="e.g. landscaping, design, follow-up"
              helperText="Separate multiple tags with commas"
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={noteForm.priority}
                label="Priority"
                onChange={(e) => setNoteForm({ ...noteForm, priority: e.target.value })}
              >
                <MenuItem value="low">🟢 Low</MenuItem>
                <MenuItem value="medium">🟡 Medium</MenuItem>
                <MenuItem value="high">🔴 High</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveNote} variant="contained">
            {editingNote ? "Update Note" : "Create Note"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}