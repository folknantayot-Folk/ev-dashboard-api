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

SENDER_EMAIL = "folksung71@gmail.com"
SENDER_PASSWORD = "ufww ytpy qrhm mvwr"

def send_alert_email_async(receiver_email, device_id, posShort, negShort):
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = receiver_email
        msg['Subject'] = f"🚨 แจ้งเตือนฉุกเฉิน: อุปกรณ์ {device_id} เกิดการช็อต!"
        
        short_type = []
        if posShort: short_type.append("ขั้วบวก (Positive)")
        if negShort: short_type.append("ขั้วลบ (Negative)")
        
        body = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #d9534f; text-align: center;">⚠️ แจ้งเตือนความผิดปกติ</h2>
            <p style="font-size: 16px;">อุปกรณ์ <b>{device_id}</b> ตรวจพบการช็อตของแบตเตอรี่!</p>
            <p style="font-size: 16px; background-color: #f9f2f4; padding: 10px; color: #c7254e; border-radius: 5px;">
                <b>ตำแหน่งที่ช็อต:</b> {', '.join(short_type)}
            </p>
            <p style="font-size: 14px; color: #555;">โปรดตรวจสอบอุปกรณ์โดยด่วน!</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <small style="color: #999;">ระบบแจ้งเตือนอัตโนมัติจาก EV Dashboard</small>
        </div>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        text = msg.as_string()
        server.sendmail(SENDER_EMAIL, receiver_email, text)
        server.quit()
        print(f"Alert email sent to {receiver_email} for device {device_id}")
    except Exception as e:
        print(f"Failed to send email: {e}")

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
                # 5 minute cooldown
                if last_alert is None or (now - last_alert) > timedelta(minutes=5):
                    device_last_alert[device_id] = now
                    # Start thread to send email asynchronously
                    threading.Thread(target=send_alert_email_async, args=(receiver_email, device_id, posShort, negShort)).start()
        
        return jsonify({"message": "Data received successfully", "status": "success"}), 200
        
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
