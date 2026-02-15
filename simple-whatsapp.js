// Simple WhatsApp Integration - Just like before
console.log('📱 Loading Simple WhatsApp Integration...');

// Configuration
const WHATSAPP_CONFIG = {
    enabled: localStorage.getItem('whatsappEnabled') === 'true',
    adminNumber: '+919103594759',
    businessName: 'ShopEasy'
};

// Add WhatsApp button
function addWhatsAppButton() {
    // Create floating button
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'whatsapp-btn';
    floatingBtn.innerHTML = '<i class="fab fa-whatsapp"></i>';
    floatingBtn.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #25D366;
        color: white;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
        z-index: 1000;
        transition: all 0.3s ease;
    `;

    floatingBtn.title = 'WhatsApp Integration';
    floatingBtn.onclick = toggleWhatsApp;

    document.body.appendChild(floatingBtn);
    updateWhatsAppButton();
}

// Toggle WhatsApp
function toggleWhatsApp() {
    if (!WHATSAPP_CONFIG.enabled) {
        showWhatsAppSetup();
    } else {
        showWhatsAppStatus();
    }
}

// Show setup
function showWhatsAppSetup() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 400px; width: 90%; text-align: center;">
            <i class="fab fa-whatsapp" style="font-size: 48px; color: #25D366; margin-bottom: 20px;"></i>
            <h2 style="margin-bottom: 15px;">WhatsApp Integration</h2>
            <p style="margin-bottom: 20px; color: #666;">Enable WhatsApp forwarding for live chat messages</p>
            <button onclick="enableWhatsApp(this)" style="background: #25D366; color: white; border: none; padding: 15px 30px; border-radius: 10px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                Enable WhatsApp
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #ccc; color: white; border: none; padding: 15px 30px; border-radius: 10px; cursor: pointer; font-size: 16px;">
                Cancel
            </button>
        </div>
    `;

    document.body.appendChild(modal);
}

// Enable WhatsApp
function enableWhatsApp(button) {
    localStorage.setItem('whatsappEnabled', 'true');
    WHATSAPP_CONFIG.enabled = true;

    button.parentElement.parentElement.remove();
    updateWhatsAppButton();

    alert('✅ WhatsApp integration enabled!\nCustomer messages will be formatted for WhatsApp.');
}

// Show status
function showWhatsAppStatus() {
    alert('📱 WhatsApp Integration: ACTIVE\n\nCustomer messages are being formatted for WhatsApp sharing.');
}

// Update button
function updateWhatsAppButton() {
    const btn = document.getElementById('whatsapp-btn');
    if (!btn) return;

    if (WHATSAPP_CONFIG.enabled) {
        btn.style.background = '#25D366';
        btn.title = 'WhatsApp Integration: ON';
    } else {
        btn.style.background = '#ccc';
        btn.title = 'WhatsApp Integration: OFF - Click to enable';
    }
}

// Hook into existing sendMessage function
const originalSendMessage = window.sendMessage;
if (originalSendMessage) {
    window.sendMessage = function() {
        originalSendMessage();

        if (WHATSAPP_CONFIG.enabled) {
            setTimeout(() => {
                const lastMessage = document.querySelector('.user-message:last-child');
                if (lastMessage) {
                    const messageText = lastMessage.textContent.trim();

                    const whatsappMessage = `🛍️ *ShopEasy Customer Message*

👤 Customer: Website Visitor
🕒 Time: ${new Date().toLocaleString()}
🌐 Website: https://ctrlxmir.github.io/reactify-mir/

💬 Message:
${messageText}

_From ShopEasy Live Chat_`;

                    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.adminNumber.replace('+', '')}?text=${encodeURIComponent(whatsappMessage)}`;

                    // Show notification
                    const notification = document.createElement('div');
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #25D366;
                        color: white;
                        padding: 15px 20px;
                        border-radius: 10px;
                        z-index: 9999;
                        font-size: 14px;
                    `;

                    notification.innerHTML = `
                        📱 WhatsApp Message Ready!
                        <br><button onclick="window.open('${whatsappUrl}', '_blank')" style="background: white; color: #25D366; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                            Open WhatsApp
                        </button>
                        <button onclick="this.parentElement.remove()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 10px; margin-left: 5px;">
                            Close
                        </button>
                    `;

                    document.body.appendChild(notification);

                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 10000);
                }
            }, 1000);
        }
    };
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addWhatsAppButton);
} else {
    addWhatsAppButton();
}

console.log('✅ Simple WhatsApp Integration Loaded');
