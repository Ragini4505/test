const express = require('express');
const cors = require('cors');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// AWS Configuration (SDK v3)
const s3 = new S3Client({
    
});
const BUCKET_NAME = 'feedback2025';

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Name and email are required fields'
            });
        }

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

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `form-submissions/data_${timestamp}_${formData.submissionId}.json`;

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

        // ✅ Upload with AWS SDK v3
        const uploadCommand = new PutObjectCommand(uploadParams);
        const result = await s3.send(uploadCommand);

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

        if (error.name === 'NoSuchBucket') {
            errorMessage = `S3 bucket '${BUCKET_NAME}' not found. Please create the bucket first.`;
            statusCode = 404;
        } else if (error.name === 'AccessDenied') {
            errorMessage = 'Access denied to S3 bucket. Check your AWS credentials and permissions.';
            statusCode = 403;
        } else if (error.name === 'InvalidAccessKeyId') {
            errorMessage = 'Invalid AWS Access Key ID. Please check your credentials.';
            statusCode = 401;
        } else if (error.name === 'SignatureDoesNotMatch') {
            errorMessage = 'Invalid AWS Secret Access Key. Please check your credentials.';
            statusCode = 401;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: error.name || 'UNKNOWN_ERROR'
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
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving HTML files from public/ directory`);
    console.log(`🪣 Using S3 bucket: ${BUCKET_NAME}`);
    console.log(`🌍 AWS Region: eu-north-1`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});