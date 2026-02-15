const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "shopeasy_webhook_token_2024";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "YOUR_WHATSAPP_ACCESS_TOKEN";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "YOUR_PHONE_NUMBER_ID";
const CHAT_LOG_FILE = path.join(__dirname, 'chat_messages.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (your ShopEasy app)
app.use(express.static('.'));

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔍 Webhook verification request:', { mode, token });

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.status(403).send('Forbidden');
    }
});

// Webhook endpoint for receiving WhatsApp messages
app.post('/webhook', async (req, res) => {
    console.log('📨 Received WhatsApp webhook:', JSON.stringify(req.body, null, 2));

    try {
        const { entry } = req.body;

        if (entry && entry[0] && entry[0].changes && entry[0].changes[0].value.messages) {
            const messages = entry[0].changes[0].value.messages;

            for (const message of messages) {
                await handleIncomingMessage(message);
            }
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(200).json({ status: 'error', message: error.message });
    }
});

// Handle incoming WhatsApp message
async function handleIncomingMessage(message) {
    const { from, id: messageId, timestamp } = message;

    console.log(`📱 Processing message from ${from}`);

    let messageText = '';
    let messageType = 'text';

    if (message.text && message.text.body) {
        messageText = message.text.body;
        messageType = 'text';
    } else if (message.image) {
        messageText = `[Image] ${message.image.caption || ''}`;
        messageType = 'image';
    } else if (message.document) {
        messageText = `[Document] ${message.document.filename || ''}`;
        messageType = 'document';
    }

    // Save message to chat log
    await saveChatMessage({
        id: messageId,
        from: from,
        message: messageText,
        type: messageType,
        timestamp: parseInt(timestamp),
        direction: 'incoming',
        source: 'whatsapp',
        customerPhone: from
    });

    // Send auto-response
    await sendAutoResponse(from, messageText);

    console.log(`✅ Message from ${from} processed and saved`);
}

// Save chat message to JSON file
async function saveChatMessage(messageData) {
    try {
        let messages = [];

        try {
            const data = await fs.readFile(CHAT_LOG_FILE, 'utf8');
            messages = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, start with empty array
            console.log('📝 Creating new chat log file');
        }

        messages.push({
            ...messageData,
            savedAt: new Date().toISOString()
        });

        // Keep only last 1000 messages
        if (messages.length > 1000) {
            messages = messages.slice(-1000);
        }

        await fs.writeFile(CHAT_LOG_FILE, JSON.stringify(messages, null, 2));
        console.log(`💾 Message saved to ${CHAT_LOG_FILE}`);

    } catch (error) {
        console.error('❌ Error saving message:', error);
    }
}

// Send auto-response to WhatsApp
async function sendAutoResponse(to, incomingMessage) {
    try {
        const response = `🛍️ *ShopEasy Customer Support*

Hi! Thanks for contacting us. We received your message:

"${incomingMessage.substring(0, 100)}${incomingMessage.length > 100 ? '...' : ''}"

Our team will respond shortly. You can also:
• Visit our website: https://ctrlxmir.github.io/reactify-mir/
• Use live chat on our website for instant support 💬
• Browse our products and offers

We're here to help! 🛍️✨`;

        await sendWhatsAppMessage(to, response);
        console.log(`📤 Auto-response sent to ${to}`);

    } catch (error) {
        console.error('❌ Error sending auto-response:', error);
    }
}

// Send message to WhatsApp
async function sendWhatsAppMessage(to, message) {
    try {
        const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: message
            }
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📤 WhatsApp message sent successfully');
        return response.data;

    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
}

// API endpoint to get chat messages
app.get('/api/messages', async (req, res) => {
    try {
        const data = await fs.readFile(CHAT_LOG_FILE, 'utf8');
        const messages = JSON.parse(data);

        // Get messages from last 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentMessages = messages.filter(msg => 
            (msg.timestamp * 1000) > oneDayAgo || new Date(msg.savedAt).getTime() > oneDayAgo
        );

        res.json({
            success: true,
            messages: recentMessages,
            count: recentMessages.length
        });

    } catch (error) {
        console.log('📝 No chat log file found, returning empty array');
        res.json({
            success: true,
            messages: [],
            count: 0
        });
    }
});

// API endpoint to send message to WhatsApp
app.post('/api/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: to, message'
            });
        }

        // Send message to WhatsApp
        await sendWhatsAppMessage(to, message);

        // Save sent message to chat log
        await saveChatMessage({
            id: `sent_${Date.now()}`,
            from: 'support',
            to: to,
            message: message,
            type: 'text',
            timestamp: Math.floor(Date.now() / 1000),
            direction: 'outgoing',
            source: 'website',
            customerPhone: to
        });

        res.json({
            success: true,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('❌ Error in send-message API:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to get active conversations
app.get('/api/conversations', async (req, res) => {
    try {
        const data = await fs.readFile(CHAT_LOG_FILE, 'utf8');
        const messages = JSON.parse(data);

        // Group messages by phone number
        const conversations = {};

        messages.forEach(msg => {
            const phone = msg.customerPhone || msg.from || msg.to;
            if (!conversations[phone]) {
                conversations[phone] = {
                    phone: phone,
                    messages: [],
                    lastMessage: null,
                    unreadCount: 0
                };
            }

            conversations[phone].messages.push(msg);

            if (!msg.lastMessage || msg.timestamp > conversations[phone].lastMessage.timestamp) {
                conversations[phone].lastMessage = msg;
            }

            if (msg.direction === 'incoming' && !msg.read) {
                conversations[phone].unreadCount++;
            }
        });

        // Convert to array and sort by last message time
        const conversationList = Object.values(conversations).sort((a, b) => {
            const aTime = a.lastMessage ? a.lastMessage.timestamp : 0;
            const bTime = b.lastMessage ? b.lastMessage.timestamp : 0;
            return bTime - aTime;
        });

        res.json({
            success: true,
            conversations: conversationList,
            count: conversationList.length
        });

    } catch (error) {
        res.json({
            success: true,
            conversations: [],
            count: 0
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Integration Server running on port ${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 API endpoints:`);
    console.log(`   GET  /api/messages - Get chat messages`);
    console.log(`   POST /api/send-message - Send message to WhatsApp`);
    console.log(`   GET  /api/conversations - Get active conversations`);
});

module.exports = app;
