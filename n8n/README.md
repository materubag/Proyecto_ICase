# Integración con n8n (Fase 2) - ICASE Automation

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

## 5. Activación en Docker Compose

Para ejecutar n8n en el entorno local junto a ICASE:

1. Descomentar el servicio `n8n` en [docker-compose.yml](file:///c:/Users/mateo/Downloads/Otros/UNI_local/DAS/Proyecto_ICase/docker-compose.yml).
2. Crear un workflow en `http://localhost:5678` con un nodo **Webhook** (método POST).
3. Copiar la URL del webhook de producción/test y definirla en `.env`:
   ```bash
   N8N_MOCKUP_WEBHOOK=http://n8n:5678/webhook/mockup-generator
   ```
4. Reiniciar el backend para que tome la nueva variable.
