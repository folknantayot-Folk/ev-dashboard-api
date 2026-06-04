from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading
from datetime import datetime, timedelta

app = Flask(__name__)
# Enable CORS for all routes so the React frontend can fetch data without issues
CORS(app)

# In-memory storage for device data (for demonstration)
# In production, this would be a database like PostgreSQL or MongoDB
devices_data = {}
device_subscriptions = {} # { "device_id": "user@email.com" }
device_last_alert = {} # { "device_id": datetime_object }
pending_commands = {} # { "device_id": "command_string" }

import urllib.request
import json

GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbye1wUOtxNsoebZ6Duows7ay5QZF42W9ImjXILe2jZy6Uu6JBqe0xsACaV_O2jFbIo/exec"

def send_alert_email_async(receiver_email, device_id, is_pos_short, is_neg_short):
    try:
        subject = f"🔴 ด่วน! พบความผิดปกติที่อุปกรณ์ {device_id}"
        
        status_text = []
        if is_pos_short:
            status_text.append("ขั้วบวกช็อต (+)")
        if is_neg_short:
            status_text.append("ขั้วลบช็อต (-)")
            
        body = f"""⚠️ แจ้งเตือนความผิดปกติของแบตเตอรี่ ⚠️

อุปกรณ์: {device_id}
สถานะ: {' และ '.join(status_text)}

ระบบตรวจพบการลัดวงจร โปรดตรวจสอบอุปกรณ์โดยด่วน!

(ส่งอัตโนมัติจากระบบ EV Dashboard)"""
        
        payload = json.dumps({
            "to": receiver_email,
            "subject": subject,
            "body": body
        }).encode('utf-8')
        
        req = urllib.request.Request(GAS_WEBHOOK_URL, data=payload, headers={'Content-Type': 'application/json'})
        response = urllib.request.urlopen(req, timeout=10)
        print("Email triggered via Webhook:", response.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Failed to send email via webhook: {e}")

@app.route('/api/subscribe', methods=['POST', 'OPTIONS'])
def subscribe_alert():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    device_id = data.get('device_id')
    email = data.get('email')
    
    if not device_id or not email:
        return jsonify({"error": "Missing device_id or email"}), 400
        
    device_subscriptions[device_id] = email
    return jsonify({"message": f"Successfully subscribed {email} to {device_id}"}), 200

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    device_id = data.get('device_id')
    command = data.get('command')
    
    if not device_id or not command:
        return jsonify({"error": "Missing device_id or command"}), 400
        
    pending_commands[device_id] = command
    return jsonify({"message": f"Command '{command}' queued for {device_id}", "status": "success"}), 200

@app.route('/api/voltage', methods=['GET', 'POST', 'OPTIONS'])
def handle_voltage():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    if request.method == 'POST':
        # The IoT device / Python script sends data here
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        device_id = data.get('device_id')
        if not device_id:
            return jsonify({"error": "Missing device_id"}), 400
            
        posShort = data.get('posShort', False)
        negShort = data.get('negShort', False)
            
        # Update or create device record
        devices_data[device_id] = {
            "device_id": device_id,
            "voltage": data.get('voltage', 0),
            "posShort": posShort,
            "negShort": negShort,
            "last_updated": datetime.now().isoformat()
        }
        
        # Check for Short Circuit Alert
        if posShort or negShort:
            receiver_email = device_subscriptions.get(device_id)
            if receiver_email:
                last_alert = device_last_alert.get(device_id)
                now = datetime.now()
                # 1 minute cooldown
                if last_alert is None or (now - last_alert) > timedelta(minutes=1):
                    device_last_alert[device_id] = now
                    # Start thread to send email asynchronously
                    threading.Thread(target=send_alert_email_async, args=(receiver_email, device_id, posShort, negShort)).start()
        
        response_payload = {"message": "Data received successfully", "status": "success"}
        
        # Check if there is a pending command for this device
        if device_id in pending_commands:
            response_payload["command"] = pending_commands.pop(device_id)
            
        return jsonify(response_payload), 200
        
    elif request.method == 'GET':
        # The React frontend fetches data from here
        device_id = request.args.get('device_id')
        
        if not device_id:
            return jsonify({"error": "Missing device_id parameter in query string"}), 400
            
        device = devices_data.get(device_id)
        
        if not device:
            # Return 404 if the device hasn't sent any data yet
            return jsonify({"error": "Device not found or offline"}), 404
            
        return jsonify(device), 200

@app.route('/', methods=['GET'])
def health_check():
    return "Backend API is running!"

if __name__ == '__main__':
    # Run on 0.0.0.0 to allow external connections (required for platforms like Render)
    app.run(host='0.0.0.0', port=5000)
