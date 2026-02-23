// Render markdown en los mensajes iniciales (como el saludo del bot)
document.addEventListener("DOMContentLoaded", () => {
  const initialMsgs = document.querySelectorAll(".markdown-body");
  initialMsgs.forEach((msg) => {
    msg.innerHTML = DOMPurify.sanitize(marked.parse(msg.textContent.trim()));
  });
});

const inputMensaje = document.getElementById("mensaje");
const btnEnviar = document.getElementById("btn-enviar");
const chatBox = document.getElementById("messages-container");
const mensajesContainer = document.getElementById("messages");

// Enviar mensaje con la tecla Enter sin Shift
inputMensaje.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    enviar();
  }
});

// Auto-crecer textarea
inputMensaje.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

async function enviar() {
  const mensaje = inputMensaje.value.trim();
  if (!mensaje) return;

  // Quitar altura
  inputMensaje.style.height = "auto";
  inputMensaje.value = "";
  inputMensaje.focus();

  // Agregar mensaje de usuario
  agregarMensajeUsuario(mensaje);

  // Crear burbuja vacía para el bot
  const botMsgId = "bot-msg-" + Date.now();
  const botMsgContent = agregarBurbujaBot(botMsgId);

  // Bloquear input temporalmente
  inputMensaje.disabled = true;
  btnEnviar.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let botResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (let line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const dataObj = JSON.parse(dataStr);
            if (dataObj.error) {
              botResponse += dataObj.error;
            } else if (dataObj.content) {
              botResponse += dataObj.content;
            }

            // Actualizar UI con markdown parseado
            botMsgContent.innerHTML = DOMPurify.sanitize(
              marked.parse(botResponse),
            );
            hacerScroll();
          } catch (e) {
            console.error("Error parseando SSE:", e, dataStr);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error en la petición:", error);
    botMsgContent.innerHTML =
      "<span class='error'><i class='ph ph-warning'></i> Error de conexión con la red central.</span>";
  } finally {
    inputMensaje.disabled = false;
    btnEnviar.disabled = false;
    inputMensaje.focus();
    hacerScroll();
  }
}

async function limpiarChat() {
  try {
    await fetch("/clear", { method: "POST" });
    mensajesContainer.innerHTML = `
            <div class="msg bot welcome-msg" style="animation: appear 0.5s ease-out forwards;">
                <div class="msg-avatar"><i class="ph ph-cpu"></i></div>
                <div class="msg-content markdown-body">
                    Memoria purgada. Sistemas reiniciados. ¿Listo para una nueva secuencia?
                </div>
            </div>
        `;
    document.querySelectorAll(".markdown-body").forEach((msg) => {
      msg.innerHTML = DOMPurify.sanitize(marked.parse(msg.textContent.trim()));
    });
  } catch (e) {
    console.error("Error limpiando memoria", e);
  }
}

function agregarMensajeUsuario(texto) {
  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `
        <div class="msg-content">
            ${texto.replace(/\n/g, "<br>")}
        </div>
    `;
  mensajesContainer.appendChild(div);
  hacerScroll();
}

function agregarBurbujaBot(id) {
  const div = document.createElement("div");
  div.className = "msg bot";
  div.innerHTML = `
        <div class="msg-avatar"><i class="ph ph-cpu"></i></div>
        <div class="msg-content markdown-body" id="${id}">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
  mensajesContainer.appendChild(div);
  hacerScroll();
  return document.getElementById(id);
}

function hacerScroll() {
  chatBox.scrollTop = chatBox.scrollHeight;
}
