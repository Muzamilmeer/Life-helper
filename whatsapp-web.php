<?php
// WhatsApp Webhook for ShopEasy Live Chat Integration
// This handles incoming messages from WhatsApp and sends them to live chat

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuration
$WEBHOOK_VERIFY_TOKEN = "shopeasy_webhook_token_2024"; // Change this to your secure token
$WHATSAPP_ACCESS_TOKEN = "YOUR_WHATSAPP_ACCESS_TOKEN"; // Get from Meta Business
$PHONE_NUMBER_ID = "YOUR_PHONE_NUMBER_ID"; // Your WhatsApp Business phone number ID
$CHAT_LOG_FILE = "chat_messages.json";

// Webhook verification (for Meta setup)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? '';

    if ($mode === 'subscribe' && $token === $WEBHOOK_VERIFY_TOKEN) {
        echo $challenge;
        exit(0);
    } else {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit(0);
    }
}

// Handle incoming WhatsApp messages
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Log incoming webhook data for debugging
    error_log("WhatsApp Webhook Data: " . $input);

    if (isset($data['entry'][0]['changes'][0]['value']['messages'])) {
        $messages = $data['entry'][0]['changes'][0]['value']['messages'];

        foreach ($messages as $message) {
            $from = $message['from'];
            $messageId = $message['id'];
            $timestamp = $message['timestamp'];

            // Handle different message types
            $messageText = '';
            $messageType = 'text';

            if (isset($message['text']['body'])) {
                $messageText = $message['text']['body'];
                $messageType = 'text';
            } elseif (isset($message['image'])) {
                $messageText = '[Image] ' . ($message['image']['caption'] ?? '');
                $messageType = 'image';
            } elseif (isset($message['document'])) {
                $messageText = '[Document] ' . ($message['document']['filename'] ?? '');
                $messageType = 'document';
            }

            // Save message to chat log
            saveChatMessage([
                'id' => $messageId,
                'from' => $from,
                'message' => $messageText,
                'type' => $messageType,
                'timestamp' => $timestamp,
                'direction' => 'incoming',
                'source' => 'whatsapp'
            ]);

            // Send auto-response if it's a new conversation
            sendAutoResponse($from, $messageText);
        }
    }

    // Always respond with 200 OK to WhatsApp
    echo json_encode(['status' => 'success']);
    exit(0);
}

// Save chat message to JSON file
function saveChatMessage($messageData) {
    global $CHAT_LOG_FILE;

    $messages = [];
    if (file_exists($CHAT_LOG_FILE)) {
        $messages = json_decode(file_get_contents($CHAT_LOG_FILE), true) ?: [];
    }

    $messages[] = $messageData;

    // Keep only last 1000 messages
    if (count($messages) > 1000) {
        $messages = array_slice($messages, -1000);
    }

    file_put_contents($CHAT_LOG_FILE, json_encode($messages, JSON_PRETTY_PRINT));
}

// Send auto-response to WhatsApp
function sendAutoResponse($to, $incomingMessage) {
    global $WHATSAPP_ACCESS_TOKEN, $PHONE_NUMBER_ID;

    // Simple auto-response logic
    $response = "🛍️ *ShopEasy Customer Support*\n\n";
    $response .= "Hi! Thanks for contacting us. We received your message:\n\n";
    $response .= "\"" . substr($incomingMessage, 0, 100) . "\"\n\n";
    $response .= "Our team will respond shortly. You can also visit our website: https://ctrlxmir.github.io/reactify-mir/\n\n";
    $response .= "For immediate assistance, check our live chat on the website! 💬";

    $data = [
        'messaging_product' => 'whatsapp',
        'to' => $to,
        'type' => 'text',
        'text' => [
            'body' => $response
        ]
    ];

    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://graph.facebook.com/v18.0/{$PHONE_NUMBER_ID}/messages",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$WHATSAPP_ACCESS_TOKEN}",
            "Content-Type: application/json"
        ]
    ]);

    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    // Log the response
    error_log("WhatsApp API Response: " . $response);

    return $httpCode === 200;
}

// API endpoint to get chat messages for the website
if (isset($_GET['action']) && $_GET['action'] === 'get_messages') {
    if (file_exists($CHAT_LOG_FILE)) {
        $messages = json_decode(file_get_contents($CHAT_LOG_FILE), true) ?: [];

        // Get messages from last 24 hours
        $oneDayAgo = time() - (24 * 60 * 60);
        $recentMessages = array_filter($messages, function($msg) use ($oneDayAgo) {
            return $msg['timestamp'] > $oneDayAgo;
        });

        echo json_encode([
            'success' => true,
            'messages' => array_values($recentMessages)
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'messages' => []
        ]);
    }
    exit(0);
}

// API endpoint to send message to WhatsApp
if (isset($_GET['action']) && $_GET['action'] === 'send_message') {
    $to = $_POST['to'] ?? '';
    $message = $_POST['message'] ?? '';

    if (empty($to) || empty($message)) {
        echo json_encode(['success' => false, 'error' => 'Missing parameters']);
        exit(0);
    }

    $data = [
        'messaging_product' => 'whatsapp',
        'to' => $to,
        'type' => 'text',
        'text' => [
            'body' => $message
        ]
    ];

    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://graph.facebook.com/v18.0/{$PHONE_NUMBER_ID}/messages",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$WHATSAPP_ACCESS_TOKEN}",
            "Content-Type: application/json"
        ]
    ]);

    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($httpCode === 200) {
        // Save sent message to chat log
        saveChatMessage([
            'id' => 'sent_' . time(),
            'from' => 'support',
            'to' => $to,
            'message' => $message,
            'type' => 'text',
            'timestamp' => time(),
            'direction' => 'outgoing',
            'source' => 'website'
        ]);

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to send message']);
    }
    exit(0);
}

// Default response
http_response_code(404);
echo json_encode(['error' => 'Not found']);
?>
