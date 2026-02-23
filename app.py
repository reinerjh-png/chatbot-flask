import os
import requests
import json
import uuid
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, session, Response

# Cargar API_KEY (desde variables de entorno o archivo local)
load_dotenv("api.env")
API_KEY = os.getenv("openAPI")

if not API_KEY:
    raise ValueError("❌ No se encontró la variable openAPI. Configúrala en Render o en api.env")

# Configuración del endpoint de OpenRouter
URL = "https://openrouter.ai/api/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Inicializar Flask
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "super-secret-key-futurista")

# Diccionario para almacenar el historial por sesión
user_sessions = {}

# Definición del sistema
SYSTEM_PROMPT = {
    "role": "system",
    "content": "Eres Isten Bot, una IA cuántica de última generación con conocimientos avanzados. Tienes una personalidad futurista, inteligente y directa. Respondes con claridad, usando formato estructurado en Markdown (tablas, negritas, listas o código) siempre que sea conveniente para hacer tus respuestas visuales. Tu creador es Reiner. Tu objetivo es ayudar y educar al usuario de la mejor forma."
}

@app.before_request
def ensure_session():
    if 'uid' not in session:
        session['uid'] = str(uuid.uuid4())
    if session['uid'] not in user_sessions:
        user_sessions[session['uid']] = [SYSTEM_PROMPT]

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("mensaje", "")
    if not user_input:
        return jsonify({"error": "⚠️ No escribiste ningún mensaje."}), 400

    uid = session['uid']
    historial = user_sessions[uid]
    
    # Agregar mensaje del usuario al historial
    historial.append({"role": "user", "content": user_input})
    
    # Limitar el historial (ej: system prompt + últimos 14 mensajes)
    if len(historial) > 15:
        user_sessions[uid] = [historial[0]] + historial[-14:]
        historial = user_sessions[uid]

    def generate():
        data = {
            "model": "gpt-4o-mini",
            "messages": historial,
            "max_tokens": 1500,
            "stream": True # Activar streaming nativo
        }
        
        try:
            response = requests.post(URL, headers=HEADERS, json=data, stream=True)
            response.raise_for_status()

            bot_reply = ""
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        json_str = decoded_line[6:]
                        if json_str == '[DONE]':
                            break
                        try:
                            chunk = json.loads(json_str)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                delta = chunk["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    bot_reply += content
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                        except json.JSONDecodeError:
                            pass
            
            # Guardar la respuesta final
            if bot_reply:
                user_sessions[uid].append({"role": "assistant", "content": bot_reply})
            yield "data: [DONE]\n\n"

        except Exception as e:
            print("❌ Error:", e)
            yield f"data: {json.dumps({'error': 'Error en la matriz de conexión cuántica.'})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route("/clear", methods=["POST"])
def clear_chat():
    uid = session.get('uid')
    if uid in user_sessions:
        user_sessions[uid] = [SYSTEM_PROMPT]
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)
