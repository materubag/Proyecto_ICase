# Integración con n8n - ICASE Automation

Este directorio documenta la arquitectura y los flujos de integración previstos entre la plataforma **ICASE** y **n8n Workflow Automation**.

---

## 1. Propósito de n8n en ICASE

n8n actuará como el orquestador desacoplado para la generación de prototipos visuales y mockups declarativos.

En lugar de vincular el backend directamente a APIs específicas de IA para generar interfaces de usuario, el backend emite una solicitud HTTP POST al webhook de n8n. n8n se encarga de:
1. Recibir los datos del proyecto, requisitos y descripción del sistema.
2. Formular los prompts óptimos para el modelo LLM (Gemini 1.5, OpenAI GPT-4o, Ollama local).
3. Validar y normalizar el JSON declarativo resultante.
4. Responder de vuelta al backend ICASE con el array de pantallas estructuradas.

---

## 2. Flujo de Datos

```
[ Frontend React (ICASE) ]
          │
          │ 1. Solicita generar/refrescar mockup (POST /api/projects/:id/mockup)
          ▼
[ Backend Express (ICASE) ]
          │
          │ 2. MockupService detecta N8N_MOCKUP_WEBHOOK y reenvía payload
          ▼
[ Webhook Trigger de n8n ]
          │
          │ 3. Nodo LLM (Gemini / OpenAI / Ollama) genera componentes
          ▼
[ Validador JSON de n8n ] (Asegura formato { screens: [...] })
          │
          │ 4. Retorna respuesta HTTP 200 con pantallas declarativas
          ▼
[ Backend Express (ICASE) ]
          │
          │ 5. Entrega JSON a la SPA
          ▼
[ MockupRenderer React ] (Interpreta JSON y monta componentes controlados)
```

---

## 3. Formato del Payload Enviado a n8n

El backend enviará al webhook de n8n el siguiente payload:

```json
{
  "projectId": "uuid-del-proyecto",
  "projectName": "Sistema de Biblioteca",
  "description": "Plataforma de gestión de préstamos de libros...",
  "systemDescription": "El usuario lector consulta el catálogo...",
  "requirements": [
    {
      "code": "RF-01",
      "name": "Catálogo de Libros",
      "type": "FUNCTIONAL",
      "priority": "HIGH"
    }
  ],
  "prompt": "Generar pantalla principal y formulario de préstamo"
}
```

---

## 4. Formato de Respuesta Requerido por ICASE

El flujo de n8n debe retornar obligatoriamente un objeto JSON con la clave `screens`:

```json
{
  "screens": [
    {
      "id": "screen-id",
      "name": "Nombre de Pantalla",
      "description": "Objetivo de la vista",
      "route": "/ruta-sugerida",
      "layout": { "type": "form | grid | master-detail" },
      "components": [
        { "type": "navbar", "label": "Barra Superior" },
        { "type": "heading", "label": "Título de Sección", "meta": { "level": 2 } },
        { "type": "input", "label": "Etiqueta", "placeholder": "Texto..." },
        { "type": "button", "label": "Acción Principal" },
        { "type": "card", "label": "Tarjeta", "description": "Contenido" },
        { "type": "table", "label": "Listado", "meta": { "headers": [...], "rows": [...] } }
      ]
    }
  ]
}
```

---

## 5. Workflow Stitch conectado al webhook

El workflow de Stitch debe comenzar con un nodo **Webhook** configurado como `POST`, por ejemplo:

```text
POST /webhook/icase-mockup
```

El nodo Webhook entrega a los nodos Code/HTTP el payload enviado por ICASE. El flujo puede conservar los nodos `create_project`, `get_project`, `generate_screen_from_text`, `list_screens`, descarga HTML y normalización, pero debe terminar con **Respond to Webhook**. No debe terminar en `Convert to File`, porque ese nodo genera un binario local y no devuelve una respuesta HTTP al backend.

El último nodo Code debe devolver este formato para que el backend pueda mostrarlo:

```json
{
  "screens": [
    {
      "id": "screen-1",
      "name": "Inicio de sesión",
      "route": "/login",
      "html": "<!doctype html><html>...</html>",
      "htmlUrl": "https://..."
    }
  ]
}
```

En `Respond to Webhook`, selecciona `Respond With: JSON` y responde con el resultado del nodo Code. Si se conserva `htmlUrl` en vez de descargar el contenido, el backend intentará descargarlo antes de entregarlo al frontend.

El backend envía `projectId`, `projectName`, `description`, `systemDescription`, `requirements` y `prompt`, así que el primer nodo Code puede construir el prompt de Stitch con `$json.body`.

## 6. Activación en Docker Compose

Para ejecutar n8n en el entorno local junto a ICASE:

1. Descomentar el servicio `n8n` en [docker-compose.yml](file:///c:/Users/mateo/Downloads/Otros/UNI_local/DAS/Proyecto_ICase/docker-compose.yml).
2. Crear un workflow en `http://localhost:5678` con un nodo **Webhook** (método POST).
3. Copiar la URL del webhook de producción/test y definirla en `.env`:
   ```bash
   N8N_MOCKUP_WEBHOOK=http://n8n:5678/webhook/mockup-generator
   ```
4. Definir la URL de producción del webhook en `.env` y reiniciar el backend para que tome la nueva variable.

```env
N8N_MOCKUP_WEBHOOK=https://tu-n8n.example.com/webhook/icase-mockup
N8N_TIMEOUT=120000
```

El botón **Generar con n8n** de la pestaña **Prototipo** llama al backend. El navegador nunca debe llamar directamente a Stitch ni contener `X-Goog-Api-Key`; esa clave debe quedar únicamente en las credenciales de n8n y debe rotarse si la clave incluida en un workflow real fue expuesta.
