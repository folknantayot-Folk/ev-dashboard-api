from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
# ต้องมี CORS เพื่อให้หน้าเว็บ React ดึงข้อมูลข้ามโดเมนได้
CORS(app)

# ตัวแปรจำลองสำหรับเก็บข้อมูล (ถ้าใช้จริงอาจจะบันทึกลง Database)
devices_data = {}

@app.route('/api/voltage', methods=['GET', 'POST'])
def handle_voltage():
    
    # -----------------------------------------------------
    # 1. ส่วนนี้สำหรับรับข้อมูล (POST) จากสคริปต์ Python ของคุณ
    # -----------------------------------------------------
    if request.method == 'POST':
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        device_id = data.get('device_id')
        if not device_id:
            return jsonify({"error": "Missing device_id"}), 400
            
        # อัปเดตข้อมูลล่าสุดของเครื่องนั้นๆ
        devices_data[device_id] = {
            "device_id": device_id,
            "voltage": data.get('voltage', 0),
            "posShort": data.get('posShort', False),
            "negShort": data.get('negShort', False),
            "last_updated": datetime.now().isoformat()
        }
        
        return jsonify({"message": "Data received successfully", "status": "success"}), 200
        
    # -----------------------------------------------------
    # 2. ส่วนนี้คือ "ทางออกข้อมูล" (GET) สำหรับส่งไปให้หน้าเว็บ React
    # -----------------------------------------------------
    elif request.method == 'GET':
        device_id = request.args.get('device_id')
        
        if not device_id:
            return jsonify({"error": "Missing device_id parameter in query string"}), 400
            
        # ค้นหาข้อมูลเครื่องนั้นจากที่เคย POST เข้ามา
        device = devices_data.get(device_id)
        
        if not device:
            # ถ้ายังไม่เคยมีข้อมูลเข้ามาเลย ให้ตอบ 404 (หน้าเว็บจะขึ้น Offline)
            return jsonify({"error": "Device not found or offline"}), 404
            
        # ถ้ามีข้อมูล ให้ส่งข้อมูล JSON กลับไป (หน้าเว็บจะขึ้น Online)
        return jsonify(device), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
