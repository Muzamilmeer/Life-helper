#!/usr/bin/env python3
"""
Simple HTTPS server for local ShopEasy app testing
This enables biometric authentication on local devices
"""

import http.server
import ssl
import socketserver
import os
import webbrowser
from pathlib import Path

class ShopEasyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom logging
        print(f"🌐 {self.address_string()} - {format % args}")

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        print("🔐 Creating self-signed certificate...")

        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )

        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Local"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "ShopEasy"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ShopEasy Local"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow()
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress("127.0.0.1"),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())

        # Write certificate and key to files
        with open("server.crt", "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        with open("server.key", "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))

        print("✅ Certificate created successfully!")
        return True

    except ImportError:
        print("⚠️  cryptography library not found. Using basic SSL context.")
        return False
    except Exception as e:
        print(f"❌ Error creating certificate: {e}")
        return False

def start_server():
    PORT = 8443
    HOST = 'localhost'

    print("🚀 Starting ShopEasy Local Server...")
    print(f"📁 Serving files from: {os.getcwd()}")

    # Create certificate if needed
    cert_exists = os.path.exists("server.crt") and os.path.exists("server.key")
    if not cert_exists:
        create_self_signed_cert()

    try:
        # Create server
        with socketserver.TCPServer((HOST, PORT), ShopEasyHTTPRequestHandler) as httpd:
            print(f"🌐 Server running at: https://{HOST}:{PORT}")
            print(f"📱 Main App: https://{HOST}:{PORT}/index.html")
            print(f"🧪 Test App: https://{HOST}:{PORT}/local-test.html")
            print("🔒 HTTPS enabled for biometric authentication")
            print("\n⚠️  IMPORTANT:")
            print("   - Browser will show 'Not Secure' warning")
            print("   - Click 'Advanced' → 'Proceed to localhost'")
            print("   - This is normal for self-signed certificates")
            print("\n🛑 Press Ctrl+C to stop server\n")

            # Configure SSL
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

            if cert_exists or os.path.exists("server.crt"):
                try:
                    context.load_cert_chain("server.crt", "server.key")
                    print("✅ Using custom certificate")
                except Exception as e:
                    print(f"⚠️  Certificate error: {e}")
                    print("🔄 Using default SSL context")
                    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
            else:
                context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE

            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

            # Auto-open browser
            url = f"https://{HOST}:{PORT}/index.html"
            print(f"🌐 Opening browser: {url}")
            webbrowser.open(url)

            # Start server
            httpd.serve_forever()

    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        print("\n💡 Alternative: Try running with Python's built-in server:")
        print("   python -m http.server 8000")
        print("   Then open: http://localhost:8000/local-test.html")

if __name__ == "__main__":
    print("🛍️  ShopEasy Local HTTPS Server")
    print("=" * 40)
    start_server()
