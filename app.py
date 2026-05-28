from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
app = Flask(__name__)
# Enable CORS for all routes so the React frontend can fetch data without issues
CORS(app)
# In-memory storage for device data (for demonstration)
# In production, this would be a database like PostgreSQL or MongoDB
devices_data = {}
@app.route('/api/voltage', methods=['GET', 'POST'])
def handle_voltage():
    if request.method == 'POST':
        # The IoT device / Python script sends data here
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        device_id = data.get('device_id')
        if not device_id:
            return jsonify({"error": "Missing device_id"}), 400
            
        # Update or create device record
        devices_data[device_id] = {
            "device_id": device_id,
            "voltage": data.get('voltage', 0),
            "posShort": data.get('posShort', False),
            "negShort": data.get('negShort', False),
            "last_updated": datetime.now().isoformat()
        }
        
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
