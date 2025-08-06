const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
// 
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// AWS Configuration
// 🔥 REPLACE WITH YOUR ACTUAL CREDENTIALS

require('dotenv').config();

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-south-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'test-feedback2025';

// Routes
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
app.get('/submit-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});

app.get('/form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        bucket: BUCKET_NAME
    });
});

// Form submission endpoint
app.post('/submit-form', async (req, res) => {
    try {
        console.log('📝 Received form submission:', req.body);
        
        const { name, email, message } = req.body;
        
        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Name and email are required fields'
            });
        }
        
        // Prepare form data with additional metadata
        const formData = {
            name: name.trim(),
            email: email.trim(),
            message: message ? message.trim() : '',
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            source: 'backend-api',
            submissionId: Date.now() + Math.random().toString(36).substring(2)
        };
        
        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `form-submissions/data_${timestamp}_${formData.submissionId}.json`;
        
        // Upload to S3
        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: JSON.stringify(formData, null, 2),
            ContentType: 'application/json',
            Metadata: {
                'submitted-by': formData.email,
                'submission-date': new Date().toISOString()
            }
        };
        
        const result = await s3.putObject(uploadParams).promise();
        
        console.log(`✅ Form data saved to S3: ${fileName}`);
        console.log('📊 S3 Response:', result);
        
        res.json({
            success: true,
            message: 'Form submitted successfully and saved to S3!',
            fileName: fileName,
            submissionId: formData.submissionId,
            timestamp: formData.timestamp
        });
        
    } catch (error) {
        console.error('❌ Error saving form to S3:', error);
        
        let errorMessage = 'Failed to save form data to S3';
        let statusCode = 500;
        
        // Handle specific AWS errors
        if (error.code === 'NoSuchBucket') {
            errorMessage = `S3 bucket '${BUCKET_NAME}' not found. Please create the bucket first.`;
            statusCode = 404;
        } else if (error.code === 'AccessDenied') {
            errorMessage = 'Access denied to S3 bucket. Check your AWS credentials and permissions.';
            statusCode = 403;
        } else if (error.code === 'InvalidAccessKeyId') {
            errorMessage = 'Invalid AWS Access Key ID. Please check your credentials.';
            statusCode = 401;
        } else if (error.code === 'SignatureDoesNotMatch') {
            errorMessage = 'Invalid AWS Secret Access Key. Please check your credentials.';
            statusCode = 401;
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: error.code || 'UNKNOWN_ERROR'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://13.201.44.49:${PORT}`);
    console.log(`📁 Serving HTML files from public/ directory`);
    console.log(`🪣 Using S3 bucket: ${BUCKET_NAME}`);
    console.log(`🌍 AWS Region: ap-south-1`);
    console.log(`📊 Health check: http://13.201.44.49:${PORT}/health`);
});

