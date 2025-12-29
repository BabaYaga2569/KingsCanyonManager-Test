import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  CameraAlt,
  Undo,
  Redo,
  Delete,
  Save,
  Visibility,
  VisibilityOff,
  Search,
  PhotoLibrary,
  ExpandMore,
} from "@mui/icons-material";
import { designLibrary, searchElements } from "../data/designLibrary";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

// SVG to Image converter
const svgToImage = (svgString, width, height) => {
  return new Promise((resolve) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${svgString}
      </svg>
    `;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

// Canvas element component
const CanvasElement = ({ element, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const [image, setImage] = useState(null);

  useEffect(() => {
    if (element.svgData) {
      svgToImage(element.svgData, element.width, element.height).then(setImage);
    }
  }, [element.svgData, element.width, element.height]);

  return (
    <>
      {image && (
        <KonvaImage
          ref={shapeRef}
          image={image}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation || 0}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            onChange({
              ...element,
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
          onTransformEnd={(e) => {
            const node = shapeRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            node.scaleX(1);
            node.scaleY(1);

            onChange({
              ...element,
              x: node.x(),
              y: node.y(),
              width: Math.max(5, node.width() * scaleX),
              height: Math.max(node.height() * scaleY),
              rotation: node.rotation(),
            });
          }}
        />
      )}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default function DesignVisualizer({ bidData, onSave, onCancel }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
  // Canvas state
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDesign, setShowDesign] = useState(true);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  
  // Canvas dimensions
  const canvasWidth = isMobile ? window.innerWidth - 40 : 800;
  const canvasHeight = isMobile ? 400 : 500;
  
  const stageRef = useRef();
  const fileInputRef = useRef();

  // Save to history
  const saveToHistory = (newElements) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  // Handle photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          setBackgroundImage(img);
          setBackgroundUrl(event.target.result);
          setPhotoDialogOpen(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  // Add element to canvas
  const addElement = (libraryElement) => {
    const newElement = {
      id: `element-${Date.now()}`,
      libraryId: libraryElement.id,
      name: libraryElement.name,
      svgData: libraryElement.svg,
      x: canvasWidth / 2 - libraryElement.size.width / 2,
      y: canvasHeight / 2 - libraryElement.size.height / 2,
      width: libraryElement.size.width,
      height: libraryElement.size.height,
      rotation: 0,
    };
    
    const newElements = [...elements, newElement];
    setElements(newElements);
    saveToHistory(newElements);
    setSelectedId(newElement.id);
  };

  // Update element
  const updateElement = (id, updates) => {
    const newElements = elements.map((el) =>
      el.id === id ? { ...el, ...updates } : el
    );
    setElements(newElements);
    saveToHistory(newElements);
  };

  // Delete selected element
  const deleteSelected = () => {
    if (selectedId) {
      const newElements = elements.filter((el) => el.id !== selectedId);
      setElements(newElements);
      saveToHistory(newElements);
      setSelectedId(null);
    }
  };

  // Undo/Redo
  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setElements(history[historyStep - 1]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setElements(history[historyStep + 1]);
    }
  };

  // Save design
  const handleSave = async () => {
    try {
      // Export canvas as image
      const uri = stageRef.current.toDataURL();
      
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const filename = `designs/${bidData.id || 'draft'}_${timestamp}.png`;
      const storageRef = ref(storage, filename);
      
      // Convert data URL to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // Upload background photo if exists
      let backgroundStorageUrl = null;
      if (backgroundUrl) {
        const bgFilename = `designs/${bidData.id || 'draft'}_${timestamp}_background.png`;
        const bgStorageRef = ref(storage, bgFilename);
        const bgResponse = await fetch(backgroundUrl);
        const bgBlob = await bgResponse.blob();
        await uploadBytes(bgStorageRef, bgBlob);
        backgroundStorageUrl = await getDownloadURL(bgStorageRef);
      }

      // Prepare design data
      const designData = {
        originalPhoto: backgroundStorageUrl,
        finalDesign: downloadUrl,
        elements: elements.map(el => ({
          libraryId: el.libraryId,
          name: el.name,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
        })),
        createdAt: new Date().toISOString(),
      };

      onSave(designData);
    } catch (error) {
      console.error("Error saving design:", error);
      alert("Failed to save design. Please try again.");
    }
  };

  // Get filtered elements
  const getFilteredElements = () => {
    if (searchTerm) {
      return searchElements(searchTerm);
    }
    
    const categories = ['pools', 'patios', 'fire', 'lighting', 'structures', 'landscaping', 'rocks'];
    return designLibrary[categories[activeTab]] || [];
  };

  const filteredElements = getFilteredElements();

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Design Visualizer
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {bidData?.customerName ? `For ${bidData.customerName}` : 'Create your design'}
        </Typography>
      </Paper>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Jobsite Photo</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Button
              variant="contained"
              startIcon={<CameraAlt />}
              onClick={handleCameraCapture}
              fullWidth
              size="large"
            >
              Take Photo
            </Button>
            <Button
              variant="outlined"
              startIcon={<PhotoLibrary />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              size="large"
            >
              Choose from Gallery
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotoDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={2}>
        {/* Canvas Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            {/* Canvas Controls */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {!backgroundImage && (
                <Button
                  variant="contained"
                  startIcon={<CameraAlt />}
                  onClick={() => setPhotoDialogOpen(true)}
                  size="small"
                >
                  Add Photo
                </Button>
              )}
              <IconButton onClick={undo} disabled={historyStep <= 0} size="small">
                <Undo />
              </IconButton>
              <IconButton onClick={redo} disabled={historyStep >= history.length - 1} size="small">
                <Redo />
              </IconButton>
              <IconButton onClick={deleteSelected} disabled={!selectedId} size="small" color="error">
                <Delete />
              </IconButton>
              <IconButton onClick={() => setShowDesign(!showDesign)} size="small">
                {showDesign ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </Box>

            {/* Canvas */}
            <Box
              sx={{
                border: '2px solid #ddd',
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: '#f5f5f5',
                position: 'relative',
              }}
            >
              {!backgroundImage && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    zIndex: 1,
                  }}
                >
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Start by adding a photo
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CameraAlt />}
                    onClick={() => setPhotoDialogOpen(true)}
                  >
                    Add Jobsite Photo
                  </Button>
                </Box>
              )}
              
              <Stage
                ref={stageRef}
                width={canvasWidth}
                height={canvasHeight}
                onClick={(e) => {
                  const clickedOnEmpty = e.target === e.target.getStage();
                  if (clickedOnEmpty) {
                    setSelectedId(null);
                  }
                }}
              >
                <Layer>
                  {/* Background Image */}
                  {backgroundImage && (
                    <KonvaImage
                      image={backgroundImage}
                      width={canvasWidth}
                      height={canvasHeight}
                    />
                  )}
                  
                  {/* Design Elements */}
                  {showDesign && elements.map((element) => (
                    <CanvasElement
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedId}
                      onSelect={() => setSelectedId(element.id)}
                      onChange={(updates) => updateElement(element.id, updates)}
                    />
                  ))}
                </Layer>
              </Stage>
            </Box>

            {/* Info */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`${elements.length} elements`} size="small" />
              {selectedId && (
                <Chip
                  label="Element selected - drag to move, handles to resize"
                  size="small"
                  color="primary"
                />
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Design Library */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Design Library
            </Typography>

            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search designs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />

            {/* Category Tabs */}
            {!searchTerm && (
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2, minHeight: 40 }}
              >
                <Tab label="Pools" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Patios" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Fire" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Lights" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Structures" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Plants" sx={{ minHeight: 40, py: 1 }} />
                <Tab label="Rocks" sx={{ minHeight: 40, py: 1 }} />
              </Tabs>
            )}

            {/* Elements Grid */}
            <Box
              sx={{
                maxHeight: isMobile ? 300 : 500,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
              }}
            >
              {filteredElements.map((element) => (
                <Paper
                  key={element.id}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    textAlign: 'center',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => addElement(element)}
                >
                  <Box
                    sx={{
                      width: '100%',
                      height: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 0.5,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `<svg width="100%" height="100%" viewBox="0 0 ${element.size.width} ${element.size.height}">${element.svg}</svg>`,
                    }}
                  />
                  <Typography variant="caption" display="block">
                    {element.name}
                  </Typography>
                </Paper>
              ))}
            </Box>

            {filteredElements.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                No elements found
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSave}
          disabled={!backgroundImage || elements.length === 0}
          startIcon={<Save />}
        >
          Save Design
        </Button>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />
    </Box>
  );
}