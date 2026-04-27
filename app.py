from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
# อนุญาตให้หน้าเว็บจากโดเมนอื่นเชื่อมต่อเข้ามาได้
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ตัวแปรจำลองฐานข้อมูลเพื่อเก็บค่าล่าสุด
current_ev_data = {
    "status_color": "gray",  # สถานะไฟ: gray, blue, green, red
    "voltage": 0.00,         # แรงดันแบตเตอรี่ (800.00)
    "measure_mode": "auto",  # โหมดการวัด: auto, manual
    "manual_v_level": 48     # ระดับ V แบบ manual: 48, 72, 400
}

@app.route('/', methods=['GET'])
def index():
    return "EV Dashboard API is running!"

# Endpoint สำหรับให้ ESP32 ส่งข้อมูลเข้ามา
@app.route('/api/update', methods=['POST'])
def update_data():
    global current_ev_data
    try:
        data = request.get_json()
        
        # อัปเดตค่าจาก ESP32
        if 'status_color' in data:
            current_ev_data['status_color'] = data['status_color']
        if 'voltage' in data:
            current_ev_data['voltage'] = float(data['voltage'])
        if 'measure_mode' in data:
            current_ev_data['measure_mode'] = data['measure_mode']
        if 'manual_v_level' in data:
            current_ev_data['manual_v_level'] = int(data['manual_v_level'])

        # ส่งข้อมูลที่อัปเดตไปยังหน้าเว็บที่เปิดอยู่ทั้งหมดแบบ Real-time
        socketio.emit('ev_data_stream', current_ev_data)

        return jsonify({"status": "success", "message": "Data updated", "data": current_ev_data}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# Endpoint สำหรับให้หน้าเว็บดึงค่าเริ่มต้นตอนเปิดหน้าเว็บครั้งแรก
@app.route('/api/current', methods=['GET'])
def get_current_data():
    return jsonify(current_ev_data), 200

if __name__ == '__main__':
    # รันเซิร์ฟเวอร์ พอร์ต 5000
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)