# Guía de diseño · Minimalista y limpio

Estilo genérico para cualquier aplicación web o móvil: **minimalista, limpio y aireado**. Menos elementos, más espacio. Debe parecer una herramienta tranquila, no un panel saturado.

## Regla de oro: no sobrecargar

- Máximo **un botón relleno** por pantalla. Las demás acciones son en contorno o texto.
- Máximo **4 indicadores** arriba en un resumen, solo número grande + etiqueta.
- Máximo **una tarjeta principal** y **una lateral** por pantalla.
- Nada de sombras, degradados, ilustraciones, fotos decorativas, emojis ni fondos de colores.
- Sin insignias de colores llamativos. Los estados se muestran con un punto pequeño y texto.
- Separar con **espacio en blanco y líneas finas de 1 px**, no con cajas dentro de cajas.
- Si algo no es esencial para la tarea de la pantalla, no se incluye.
- Un solo color de acento. Todo lo demás es blanco, gris y negro.

## Color

| Rol | Valor |
|---|---|
| Fondo de página | #FAFAF9 |
| Superficie (tarjetas, barra, campos) | #FFFFFF |
| Línea divisoria | #E7E5E0 |
| Borde de controles | #D6D3CC |
| Texto principal | #111111 |
| Texto secundario | #5F5F5A |
| **Acento (único, intercambiable)** | **#4338CA** |
| Éxito | #1F7A4D |
| Error / obligatorio | #B42318 |

El acento se usa solo en: botón principal, enlaces, elemento de navegación activo, opción seleccionada y barra de progreso. Se puede sustituir por otro color (por ejemplo #0F766E o #B45309) sin cambiar nada más.

## Tipografía

Fuente **Inter**.

- Título de página: 34 px, semibold, interlineado ajustado.
- Número destacado: 38 px, semibold.
- Título de tarjeta: 22 px, semibold.
- Texto base: 14–15 px, regular.
- Texto secundario: 13 px, gris.
- Etiquetas de sección: 12 px, MAYÚSCULAS, espaciado amplio, gris.

## Forma y espacio

- Tarjetas: borde 1 px #E7E5E0, esquinas 16 px, padding 32 px, **sin sombra**.
- Botones y campos: esquinas 10 px, alto 48 px (mínimo 44 px de área táctil).
- Contenido centrado, ancho máximo 1200 px, márgenes laterales 32 px.
- Separación entre secciones: 40 px. Entre campos de formulario: 32 px.
- Mucho espacio vacío es deseable.

## Componentes

- **Barra superior:** fondo blanco, borde inferior fino. Nombre o logo a la izquierda, 4–5 enlaces de texto y usuario a la derecha. El enlace activo lleva un subrayado de 2 px en el acento. Sin íconos junto a los enlaces.
- **Botón principal:** fondo acento, texto blanco. **Secundario:** fondo blanco con borde. **Enlace:** solo texto.
- **Campos:** etiqueta arriba (14 px, medio), asterisco rojo si es obligatorio, campo blanco con borde fino.
- **Opciones cortas:** fila de botones iguales; el seleccionado se rellena con el acento.
- **Indicadores:** sin tarjeta, solo línea superior fina, etiqueta en mayúsculas, número grande y una nota corta.
- **Listas de datos:** filas con línea fina arriba; etiqueta gris a la izquierda, valor a la derecha. Valores vacíos como "—" en gris.
- **Progreso:** barra de 6 px, pista #ECEAE4, relleno acento, y dos cifras pequeñas debajo.
- **Íconos:** solo de línea fina, y únicamente si ayudan a entender; por defecto, ninguno.

## Estructura de pantalla

1. Ruta de navegación pequeña y gris.
2. Título + una línea de descripción.
3. Acciones (máximo 3: una principal, dos secundarias).
4. Resumen opcional (máximo 4 indicadores).
5. Contenido: una tarjeta principal y, si hace falta, una lateral.

En móvil, todo se apila en una sola columna.

## Idioma y tono

Interfaz en el idioma español Textos cortos y directos. Sin texto de relleno.
