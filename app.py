from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

current_ev_data = {
    "status_color": "gray",
    "voltage": 0.00,
    "measure_mode": "auto",
    "manual_v_level": 48
}

@app.route('/', methods=['GET'])
def index():
    return "EV Dashboard API is running!"

# 🟢 ส่วนนี้แหละครับที่เซิร์ฟเวอร์กำลังตามหา! 🟢
@app.route('/api/update', methods=['POST'])
def update_data():
    global current_ev_data
    try:
        data = request.get_json()
        if 'status_color' in data: current_ev_data['status_color'] = data['status_color']
        if 'voltage' in data: current_ev_data['voltage'] = float(data['voltage'])
        if 'measure_mode' in data: current_ev_data['measure_mode'] = data['measure_mode']
        if 'manual_v_level' in data: current_ev_data['manual_v_level'] = int(data['manual_v_level'])

        socketio.emit('ev_data_stream', current_ev_data)
        return jsonify({"status": "success", "message": "Data updated"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/current', methods=['GET'])
def get_current_data():
    return jsonify(current_ev_data), 200

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
