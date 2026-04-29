from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# 🗂️ 1. เปลี่ยนมาใช้ Dictionary เพื่อเก็บข้อมูลแยกตามรายเครื่อง
all_devices_data = {}

@app.route('/', methods=['GET'])
def index():
    return "EV Dashboard API: Multi-Device Server is running!"

@app.route('/api/update', methods=['POST'])
def update_data():
    global all_devices_data
    try:
        data = request.get_json()
        
        # 🔑 2. ตรวจสอบว่ามีป้ายชื่อ (device_id) ส่งมาด้วยไหม
        device_id = data.get('device_id')
        if not device_id:
            return jsonify({"status": "error", "message": "ต้องระบุ device_id เสมอ"}), 400

        # 🆕 3. ถ้าเป็นเครื่องใหม่ที่เพิ่งเคยส่งข้อมูลมาครั้งแรก ให้สร้างตู้ล็อกเกอร์ให้ก่อน
        if device_id not in all_devices_data:
            all_devices_data[device_id] = {
                "status_color": "gray",
                "voltage": 0.00,
                "measure_mode": "auto",
                "manual_v_level": 48
            }

        # 🔄 4. อัปเดตข้อมูลเฉพาะเครื่องนั้นๆ (เก็บลงตู้ให้ถูกคน)
        if 'status_color' in data: all_devices_data[device_id]['status_color'] = data['status_color']
        if 'voltage' in data: all_devices_data[device_id]['voltage'] = float(data['voltage'])
        if 'measure_mode' in data: all_devices_data[device_id]['measure_mode'] = data['measure_mode']
        if 'manual_v_level' in data: all_devices_data[device_id]['manual_v_level'] = int(data['manual_v_level'])

        # 🚀 5. ส่งข้อมูลขึ้นหน้าเว็บ โดยพ่วง device_id ไปด้วย หน้าเว็บจะได้รู้ว่าเข็มของเครื่องไหนต้องกระดิก
        emit_data = all_devices_data[device_id].copy()
        emit_data['device_id'] = device_id
        socketio.emit('ev_data_stream', emit_data)

        return jsonify({"status": "success", "message": f"อัปเดตข้อมูลของเครื่อง {device_id} สำเร็จ"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/current', methods=['GET'])
def get_current_data():
    # ดึงข้อมูลของทุกเครื่องมาดูได้เลย (มีประโยชน์ตอนทำหน้า Dashboard รวม)
    return jsonify(all_devices_data), 200

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
