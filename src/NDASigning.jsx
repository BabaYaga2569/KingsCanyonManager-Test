import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';
import { db, storage } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const NDASigning = ({ currentUser, onNDAComplete }) => {
  const navigate = useNavigate();
  const signaturePadRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const ndaContentRef = useRef(null);

  // Check if user has scrolled to bottom of NDA
  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Clear signature
  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setSignatureEmpty(true);
    }
  };

  // Handle signature pad changes
  const handleSignatureEnd = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      setSignatureEmpty(false);
    }
  };

  // Submit NDA signature
  const handleSubmitNDA = async () => {
    try {
      // Validation
      if (!hasScrolledToBottom) {
        Swal.fire({
          icon: 'warning',
          title: 'Please Read the NDA',
          text: 'Please scroll to the bottom and read the entire NDA before signing.'
        });
        return;
      }

      if (!hasAgreed) {
        Swal.fire({
          icon: 'warning',
          title: 'Agreement Required',
          text: 'Please check the box to confirm you agree to the NDA terms.'
        });
        return;
      }

      if (signatureEmpty || !signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        Swal.fire({
          icon: 'warning',
          title: 'Signature Required',
          text: 'Please provide your signature before submitting.'
        });
        return;
      }

      setLoading(true);

      // Get signature as base64 PNG
      const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');

      // Upload signature to Firebase Storage
      const timestamp = new Date().getTime();
      const signatureRef = ref(storage, `nda-signatures/${currentUser.uid}_${timestamp}.png`);
      await uploadString(signatureRef, signatureDataUrl, 'data_url');

      // Get the download URL
      const signatureUrl = await getDownloadURL(signatureRef);

      // Update user document in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        ndaSigned: true,
        ndaSignedDate: new Date().toISOString(),
        ndaSignatureUrl: signatureUrl,
        firstLogin: false,
        updatedAt: new Date().toISOString()
      });

      // Success!
      await Swal.fire({
        icon: 'success',
        title: 'NDA Signed Successfully!',
        text: 'Welcome to Kings Canyon Landscaping! You can now access your dashboard.',
        confirmButtonText: 'Continue'
      });

      // Call callback or navigate
      if (onNDAComplete) {
        onNDAComplete();
      } else {
        navigate('/employee-dashboard');
      }

    } catch (error) {
      console.error('Error submitting NDA:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to submit NDA signature. Please try again or contact your manager.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card elevation={3}>
        <CardContent>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              📋 Non-Disclosure Agreement
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Kings Canyon Landscaping LLC
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Welcome!</strong> Please read the following Non-Disclosure Agreement carefully. 
            You must scroll to the bottom, agree to the terms, and provide your signature to continue.
          </Alert>

          {/* NDA Content (Scrollable) */}
          <Paper 
            ref={ndaContentRef}
            onScroll={handleScroll}
            elevation={0}
            sx={{ 
              maxHeight: '400px', 
              overflowY: 'auto', 
              p: 3, 
              mb: 3,
              border: '1px solid #e0e0e0',
              backgroundColor: '#fafafa'
            }}
          >
            <Typography variant="body1" paragraph>
              <strong>CONFIDENTIAL INFORMATION AND NON-DISCLOSURE AGREEMENT</strong>
            </Typography>

            <Typography variant="body2" paragraph>
              This Non-Disclosure Agreement ("Agreement") is entered into as of the date of signature below 
              by and between Kings Canyon Landscaping LLC ("Company") and the undersigned employee ("Employee").
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>1. Purpose:</strong> During the course of employment with the Company, Employee may have 
              access to certain confidential and proprietary information. This Agreement is intended to prevent 
              unauthorized disclosure of such information.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>2. Confidential Information:</strong> "Confidential Information" includes, but is not limited to:
            </Typography>

            <Box component="ul" sx={{ pl: 4, mb: 2 }}>
              <li><Typography variant="body2">Customer lists, contact information, and project details</Typography></li>
              <li><Typography variant="body2">Pricing structures, bid strategies, and financial information</Typography></li>
              <li><Typography variant="body2">Business plans, marketing strategies, and operational procedures</Typography></li>
              <li><Typography variant="body2">Proprietary designs, landscape plans, and project specifications</Typography></li>
              <li><Typography variant="body2">Employee information, payroll data, and compensation structures</Typography></li>
              <li><Typography variant="body2">Vendor relationships, supplier agreements, and trade secrets</Typography></li>
              <li><Typography variant="body2">Any information marked as "confidential" or that a reasonable person would understand to be confidential</Typography></li>
            </Box>

            <Typography variant="body2" paragraph>
              <strong>3. Obligations:</strong> Employee agrees to:
            </Typography>

            <Box component="ul" sx={{ pl: 4, mb: 2 }}>
              <li><Typography variant="body2">Hold all Confidential Information in strict confidence</Typography></li>
              <li><Typography variant="body2">Not disclose Confidential Information to any third party without prior written consent</Typography></li>
              <li><Typography variant="body2">Use Confidential Information solely for performing job duties for the Company</Typography></li>
              <li><Typography variant="body2">Take reasonable precautions to prevent unauthorized disclosure</Typography></li>
              <li><Typography variant="body2">Return or destroy all Confidential Information upon termination of employment</Typography></li>
            </Box>

            <Typography variant="body2" paragraph>
              <strong>4. Exceptions:</strong> This Agreement does not apply to information that:
            </Typography>

            <Box component="ul" sx={{ pl: 4, mb: 2 }}>
              <li><Typography variant="body2">Is or becomes publicly available through no fault of Employee</Typography></li>
              <li><Typography variant="body2">Was rightfully in Employee's possession prior to disclosure by Company</Typography></li>
              <li><Typography variant="body2">Is independently developed by Employee without use of Confidential Information</Typography></li>
              <li><Typography variant="body2">Must be disclosed pursuant to law, court order, or government regulation (with notice to Company)</Typography></li>
            </Box>

            <Typography variant="body2" paragraph>
              <strong>5. Non-Solicitation:</strong> During employment and for a period of 12 months after termination, 
              Employee agrees not to directly solicit Company customers for competing landscaping services.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>6. Term:</strong> This Agreement begins on the date of signature and continues during employment 
              and for a period of 3 years following termination of employment for any reason.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>7. Remedies:</strong> Employee acknowledges that breach of this Agreement may cause irreparable 
              harm to the Company and that monetary damages may be inadequate. Company shall be entitled to seek 
              equitable relief, including injunction and specific performance, in addition to all other remedies available at law.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>8. General Provisions:</strong>
            </Typography>

            <Box component="ul" sx={{ pl: 4, mb: 2 }}>
              <li><Typography variant="body2">This Agreement is governed by the laws of Arizona</Typography></li>
              <li><Typography variant="body2">This Agreement constitutes the entire agreement regarding confidentiality</Typography></li>
              <li><Typography variant="body2">Any modifications must be in writing and signed by both parties</Typography></li>
              <li><Typography variant="body2">If any provision is found invalid, the remaining provisions remain in effect</Typography></li>
            </Box>

            <Typography variant="body2" paragraph sx={{ mt: 3 }}>
              <strong>By signing below, Employee acknowledges that they have read, understood, and agree to be bound 
              by the terms of this Non-Disclosure Agreement.</strong>
            </Typography>

            {/* Scroll indicator at bottom */}
            {!hasScrolledToBottom && (
              <Box sx={{ textAlign: 'center', mt: 2, py: 1, backgroundColor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="body2" color="warning.dark">
                  ⬇️ Please scroll to the bottom to continue
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Agreement Checkbox */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  disabled={!hasScrolledToBottom}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  I have read and agree to the terms of this Non-Disclosure Agreement
                  {!hasScrolledToBottom && ' (scroll to bottom first)'}
                </Typography>
              }
            />
          </Box>

          {/* Signature Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ✍️ Your Signature
            </Typography>
            <Paper 
              elevation={0} 
              sx={{ 
                border: '2px solid #1976d2', 
                borderRadius: 2,
                backgroundColor: '#fff',
                mb: 2
              }}
            >
              <SignatureCanvas
                ref={signaturePadRef}
                canvasProps={{
                  style: {
                    width: '100%',
                    height: '200px',
                    cursor: 'crosshair'
                  }
                }}
                backgroundColor="white"
                onEnd={handleSignatureEnd}
              />
            </Paper>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleClearSignature}
              size="small"
            >
              Clear Signature
            </Button>
          </Box>

          {/* Submit Button */}
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleSubmitNDA}
              disabled={loading || !hasScrolledToBottom || !hasAgreed || signatureEmpty}
              sx={{ px: 6, py: 1.5 }}
            >
              {loading ? 'Submitting...' : 'Submit NDA'}
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              By clicking Submit, you electronically sign this agreement
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default NDASigning;