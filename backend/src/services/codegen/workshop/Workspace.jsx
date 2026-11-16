import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import api from "../api/client";
import AppShell from "./AppShell";
import config from "../workshop.profile.json";

const Context = createContext(null);
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const endpoint = (name) => config.resources[name].endpoint;
const money = (value) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    Number(value || 0),
  );
const text = (value) =>
  value == null || value === ""
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Sí"
        : "No"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
const date = (value) =>
  value
    ? new Date(value).toLocaleString("es-EC", {
        timeZone: config.settings.timeZone,
      })
    : "—";
const caption = (row) =>
  row.placa
    ? [row.placa, row.marca, row.modelo].filter(Boolean).join(" · ")
    : row.nombre ||
      row.correo ||
      row.codigo ||
      row.codigoObd ||
      (row.id == null ? "—" : `#${row.id}`);
const options = (rows) =>
  (rows || []).map((row) => ({ value: row.id, label: caption(row) }));
const roleKey = (user) =>
  Object.keys(config.roles).find(
    (key) =>
      normalize(config.roles[key]) === normalize(user?.role || user?.rol),
  );
const aliases = {
  misVehiculos: "vehiculos",
  citasCliente: "citas",
  cotizacionesCliente: "cotizaciones",
  seguimientoCliente: "ordenes",
  repuestos: "productos",
  usuariosAuditoria: "usuarios",
  indicadores: "reportes",
  permisos: "roles",
  taller: "ordenes",
  historial: "expediente",
};
function readLocation() {
  const [key, query = ""] = window.location.hash.slice(1).split("?");
  return {
    key: aliases[key] || key || "dashboard",
    query: new URLSearchParams(query),
  };
}
function useData(url) {
  const [state, setState] = useState({
      data: [],
      loading: Boolean(url),
      error: "",
    }),
    sequence = useRef(0);
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    if (!url) {
      setState({ data: [], loading: false, error: "" });
      return;
    }
    setState((old) => ({ ...old, loading: true, error: "" }));
    try {
      const data = await api.get(url);
      if (id === sequence.current)
        setState({ data, loading: false, error: "" });
    } catch (error) {
      if (id === sequence.current)
        setState({ data: [], loading: false, error: error.message });
    }
  }, [url]);
  useEffect(() => {
    reload();
    window.addEventListener("workshop:updated", reload);
    window.addEventListener("focus", reload);
    return () => {
      sequence.current++;
      window.removeEventListener("workshop:updated", reload);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  return {
    ...state,
    reload,
    rows: Array.isArray(state.data) ? state.data : state.data?.resultados || [],
  };
}
function useRows(name, enabled = true) {
  const session = useContext(Context);
  return useData(
    enabled && session.can("GET", endpoint(name)) ? endpoint(name) : null,
  );
}
function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  secondary = false,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${secondary ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Message({ error, children }) {
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border p-3 text-sm ${error ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}
    >
      {children}
    </div>
  ) : null;
}
function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
function State({ source }) {
  return (
    <>
      {source.loading && <p role="status">Cargando…</p>}
      {source.error && (
        <Message error>
          {source.error}{" "}
          <Button secondary onClick={source.reload}>
            Reintentar
          </Button>
        </Message>
      )}
    </>
  );
}
function Table({ source, rows, columns, actions, label = "Registros" }) {
  const [search, setSearch] = useState("");
  const items = rows || source?.rows || [],
    filtered = items.filter((row) =>
      normalize(
        columns
          .map((column) =>
            typeof column.value === "function"
              ? column.value(row)
              : row[column.key],
          )
          .join(" "),
      ).includes(normalize(search)),
    );
  return (
    <div className="space-y-3">
      {source && <State source={source} />}
      <label className="block text-sm">
        Buscar en {label.toLowerCase()}
        <input
          type="search"
          className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="space-y-3 md:hidden">
        {filtered.map((row) => (
          <article
            key={row.id || row.codigo}
            className="rounded-xl border border-slate-200 p-3"
          >
            <dl className="space-y-2 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{column.label}</dt>
                  <dd className="break-words text-right font-medium">
                    {text(column.value ? column.value(row) : row[column.key])}
                  </dd>
                </div>
              ))}
            </dl>
            {actions && (
              <div className="mt-3 flex flex-wrap gap-2">{actions(row)}</div>
            )}
          </article>
        ))}
        {!source?.loading && !source?.error && !filtered.length && (
          <p className="p-3 text-slate-500">No hay registros para mostrar.</p>
        )}
      </div>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table aria-label={label} className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th className="p-3" key={column.key}>
                  {column.label}
                </th>
              ))}
              {actions && <th className="p-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                className="border-t border-slate-100"
                key={row.id || row.codigo}
              >
                {columns.map((column) => (
                  <td className="p-3 align-top" key={column.key}>
                    {text(column.value ? column.value(row) : row[column.key])}
                  </td>
                ))}
                {actions && (
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
            {!source?.loading && !source?.error && !filtered.length && (
              <tr>
                <td
                  className="p-6 text-slate-500"
                  colSpan={columns.length + (actions ? 1 : 0)}
                >
                  No hay registros para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const field = (name, label, type = "text", extra = {}) => ({
  name,
  label,
  type,
  ...extra,
});
const select = (name, label, rows, extra = {}) =>
  field(name, label, "select", { options: options(rows), ...extra });
function Form({
  title,
  fields,
  initial = {},
  onSubmit,
  submit = "Guardar",
  onCancel,
  children,
  reset = true,
  successMessage = "Cambios guardados.",
}) {
  const [values, setValues] = useState(() => ({ ...initial })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const key = useRef(crypto.randomUUID());
  const send = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = {};
      for (const item of fields) {
        const value = values[item.name];
        if (item.type === "files") {
          payload[item.name] = Array.from(value || []);
          continue;
        }
        if (value === "" || value == null) {
          if (item.required)
            throw new Error(`Complete ${item.label.toLowerCase()}.`);
          continue;
        }
        payload[item.name] =
          item.type === "number"
            ? Number(value)
            : item.type === "checkbox"
              ? Boolean(value)
              : item.type === "multiple"
                ? Array.isArray(value)
                  ? value.map(Number)
                  : []
                : item.type === "select" && item.numeric !== false
                  ? Number(value)
                  : value;
      }
      await onSubmit(payload, key.current);
      setSuccess(successMessage);
      key.current = crypto.randomUUID();
      if (reset) setValues({ ...initial });
    } catch (failure) {
      setError(failure.message || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      aria-label={title}
      onSubmit={send}
      className="space-y-4 rounded-2xl border border-indigo-100 bg-slate-50 p-5"
    >
      <h3 className="font-bold text-slate-900">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((item) => (
          <label
            key={item.name}
            className={`block text-sm font-medium text-slate-700 ${item.type === "textarea" || item.type === "files" ? "md:col-span-2" : ""}`}
          >
            {item.label}
            {item.required ? " *" : ""}
            {item.type === "select" || item.type === "multiple" ? (
              <select
                aria-label={item.label}
                required={item.required}
                disabled={busy || item.disabled}
                multiple={item.type === "multiple"}
                value={
                  values[item.name] ?? (item.type === "multiple" ? [] : "")
                }
                onChange={(event) =>
                  setValues({
                    ...values,
                    [item.name]:
                      item.type === "multiple"
                        ? Array.from(event.target.selectedOptions).map(
                            (option) => option.value,
                          )
                        : event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option disabled={item.required} value="">
                  Seleccione…
                </option>
                {(item.options || []).map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            ) : item.type === "textarea" ? (
              <textarea
                aria-label={item.label}
                required={item.required}
                disabled={busy}
                value={values[item.name] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [item.name]: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
            ) : (
              <input
                aria-label={item.label}
                type={item.type === "files" ? "file" : item.type}
                multiple={item.type === "files"}
                accept={item.type === "files" ? "image/*" : undefined}
                required={item.required}
                disabled={busy || item.disabled}
                min={item.min}
                max={item.max}
                step={item.type === "number" ? item.step || "any" : undefined}
                minLength={item.minLength}
                {...(item.type === "checkbox"
                  ? { checked: Boolean(values[item.name]) }
                  : item.type === "files"
                    ? {}
                    : { value: values[item.name] ?? "" })}
                onChange={(event) =>
                  setValues({
                    ...values,
                    [item.name]:
                      item.type === "files"
                        ? event.target.files
                        : item.type === "checkbox"
                          ? event.target.checked
                          : event.target.value,
                  })
                }
                className={
                  item.type === "checkbox"
                    ? "ml-3"
                    : "mt-1 w-full rounded-lg border border-slate-300 p-2"
                }
              />
            )}{" "}
            {item.help && (
              <span className="block text-xs text-slate-500">{item.help}</span>
            )}
          </label>
        ))}
      </div>
      {children}
      <Message error>{error}</Message>
      <Message>{success}</Message>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : submit}
        </Button>
        {onCancel && (
          <Button secondary onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
function Dialog({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-10"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button secondary onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Catalog({
  name,
  title,
  fields,
  columns,
  initial = {},
  extraActions,
  children,
  disableEdit = false,
  createLabel,
}) {
  const session = useContext(Context),
    source = useRows(name);
  const [editing, setEditing] = useState(null);
  return (
    <Panel title={title}>
      <div className="flex flex-wrap gap-2">
        {session.can("POST", endpoint(name)) && (
          <Button onClick={() => setEditing({})}>
            {createLabel || "Nuevo " + title.toLowerCase()}
          </Button>
        )}
        <Button secondary onClick={source.reload}>
          Actualizar
        </Button>
      </div>
      <Table
        source={source}
        label={title}
        columns={columns}
        actions={(row) => (
          <>
            {!disableEdit && session.can("PUT", endpoint(name) + "/:id") && (
              <Button secondary onClick={() => setEditing(row)}>
                Editar
              </Button>
            )}
            {extraActions?.(row)}
          </>
        )}
      />
      {children}
      {editing && (
        <Dialog
          title={
            editing.id
              ? `Editar ${title.toLowerCase()}`
              : `Nuevo ${title.toLowerCase()}`
          }
          onClose={() => setEditing(null)}
        >
          <Form
            key={editing.id || "new"}
            title={title}
            fields={fields}
            initial={{ ...initial, ...editing }}
            onSubmit={async (data) => {
              await session.mutate(
                editing.id ? "PUT" : "POST",
                endpoint(name) + (editing.id ? "/" + editing.id : ""),
                data,
              );
              setEditing(null);
            }}
          />
        </Dialog>
      )}
    </Panel>
  );
}
function useAction() {
  const session = useContext(Context),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    run: async (fn) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        return await fn();
      } catch (failure) {
        setError(failure.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
  };
}
async function upload(files) {
  const ids = [];
  for (const file of files || []) {
    const body = new FormData();
    body.append("file", file);
    const response = await api.post("/upload", body);
    ids.push(response.archivoId);
  }
  return ids;
}
function PrivatePhoto({ item }) {
  const [src, setSrc] = useState(""),
    [error, setError] = useState("");
  const url =
    item.urlThumbnail || item.urlOptimizada || item.urlOriginal || item.url;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let objectUrl;
    api
      .blob(url, { signal: controller.signal })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return (
    <figure className="rounded-xl border p-2">
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img
            src={src}
            alt={item.observaciones || "Evidencia del vehículo"}
            className="h-36 w-48 object-contain"
          />
        </a>
      ) : (
        <p>{error || "Cargando evidencia…"}</p>
      )}
      <figcaption className="text-xs text-slate-600">
        {item.observaciones || "Evidencia"}
      </figcaption>
    </figure>
  );
}
function Lines({
  kind = "quote",
  services = [],
  products = [],
  value,
  onChange,
}) {
  const catalog =
    kind === "quote"
      ? [
          ...services.map((row) => ({
            ...row,
            key: "S" + row.id,
            type: "SERVICIO",
            rate: Number(row.precioManoObra || 0),
          })),
          ...products.map((row) => ({
            ...row,
            key: "P" + row.id,
            type: "REPUESTO",
            rate: Number(row.precio || 0),
          })),
        ]
      : products.map((row) => ({
          ...row,
          key: "P" + row.id,
          type: "REPUESTO",
          rate: Number(kind === "purchase" ? row.costo || 0 : row.precio || 0),
        }));
  const update = (index, key, next) =>
    onChange(
      value.map((row, i) => (i === index ? { ...row, [key]: next } : row)),
    );
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">
        {kind === "consume" ? "Repuestos utilizados" : "Conceptos"}
      </h3>
      {value.map((line, index) => (
        <div
          key={line.keyId}
          className="grid gap-2 rounded-xl border p-3 sm:grid-cols-5"
        >
          <label className="sm:col-span-2 text-sm">
            Concepto
            <select
              aria-label={`Concepto ${index + 1}`}
              required
              value={line.catalogKey || ""}
              onChange={(event) => {
                const item = catalog.find(
                  (row) => row.key === event.target.value,
                );
                onChange(
                  value.map((row, i) =>
                    i === index
                      ? {
                          ...row,
                          catalogKey: item.key,
                          servicioId:
                            item.type === "SERVICIO" ? item.id : undefined,
                          productoId:
                            item.type === "REPUESTO" ? item.id : undefined,
                          descripcion: item.nombre,
                          precioUnitario: item.rate,
                          costoUnitario: item.rate,
                        }
                      : row,
                  ),
                );
              }}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleccione…</option>
              {catalog
                .filter((row) => row.activo !== false)
                .map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.type === "SERVICIO" ? "Servicio" : "Repuesto"} ·{" "}
                    {caption(row)}
                    {row.type === "REPUESTO"
                      ? ` · stock ${row.existencias ?? 0}`
                      : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Cantidad
            <input
              aria-label={`Cantidad ${index + 1}`}
              type="number"
              min="0.01"
              step="0.01"
              required
              value={line.cantidad}
              onChange={(event) =>
                update(index, "cantidad", Number(event.target.value))
              }
              className="w-full rounded-lg border p-2"
            />
          </label>
          {kind !== "consume" && (
            <label className="text-sm">
              {kind === "purchase" ? "Costo unitario" : "Precio unitario"}
              <input
                aria-label={`Precio ${index + 1}`}
                type="number"
                min="0"
                step="0.01"
                required
                value={
                  line[
                    kind === "purchase" ? "costoUnitario" : "precioUnitario"
                  ] ?? 0
                }
                onChange={(event) =>
                  update(
                    index,
                    kind === "purchase" ? "costoUnitario" : "precioUnitario",
                    Number(event.target.value),
                  )
                }
                className="w-full rounded-lg border p-2"
              />
            </label>
          )}
          <Button
            secondary
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Quitar concepto {index + 1}
          </Button>
          {kind === "quote" && (
            <label className="text-sm">
              Impuesto del concepto
              <input
                aria-label={`Impuesto ${index + 1}`}
                type="number"
                min="0"
                step="0.01"
                value={line.impuesto || 0}
                onChange={(event) =>
                  update(index, "impuesto", Number(event.target.value))
                }
                className="w-full rounded-lg border p-2"
              />
            </label>
          )}
        </div>
      ))}
      <Button
        secondary
        onClick={() =>
          onChange([
            ...value,
            { keyId: crypto.randomUUID(), cantidad: 1, impuesto: 0 },
          ])
        }
      >
        Agregar concepto
      </Button>
      {kind !== "consume" && (
        <p className="font-semibold">
          Total previsto:{" "}
          {money(
            value.reduce(
              (sum, line) =>
                sum +
                Number(line.cantidad || 0) *
                  Number(
                    line[
                      kind === "purchase" ? "costoUnitario" : "precioUnitario"
                    ] || 0,
                  ) +
                Number(line.impuesto || 0),
              0,
            ),
          )}
        </p>
      )}
    </div>
  );
}
function payloadLines(lines, kind = "quote") {
  if (!lines.length) throw new Error("Agregue al menos un concepto.");
  return lines.map((line) => {
    if (!line.servicioId && !line.productoId)
      throw new Error("Seleccione cada concepto.");
    if (!(line.cantidad > 0))
      throw new Error("Las cantidades deben ser positivas.");
    return kind === "purchase"
      ? {
          productoId: line.productoId,
          cantidad: line.cantidad,
          costoUnitario: line.costoUnitario,
        }
      : kind === "consume"
        ? { productoId: line.productoId, cantidad: line.cantidad }
        : Object.fromEntries(
            Object.entries({
              servicioId: line.servicioId,
              productoId: line.productoId,
              descripcion: line.descripcion,
              cantidad: line.cantidad,
              precioUnitario: line.precioUnitario,
              impuesto: line.impuesto || 0,
            }).filter(([, value]) => value !== undefined),
          );
  });
}

// Modules below consume only persisted API responses.
function Services() {
  return (
    <Catalog
      name="SERVICIO"
      title="Servicio"
      initial={{ activo: true, precioManoObra: 0, duracionEstimada: 60 }}
      fields={[
        field("nombre", "Nombre", "text", { required: true }),
        field("descripcion", "Descripción", "textarea", { required: true }),
        field("precioManoObra", "Mano de obra", "number", {
          required: true,
          min: 0,
        }),
        field("duracionEstimada", "Duración en minutos", "number", {
          required: true,
          min: 1,
          step: 1,
        }),
        field("activo", "Activo", "checkbox"),
      ]}
      columns={[
        { key: "nombre", label: "Servicio" },
        { key: "descripcion", label: "Descripción" },
        {
          key: "precioManoObra",
          label: "Tarifa",
          value: (row) => money(row.precioManoObra),
        },
        { key: "duracionEstimada", label: "Minutos" },
        { key: "activo", label: "Activo" },
      ]}
    />
  );
}
function Customers() {
  const session = useContext(Context),
    action = useAction();
  return (
    <>
      <Message error>{action.error}</Message>
      <Catalog
        name="CLIENTE"
        title="Cliente"
        fields={[
          field("nombre", "Nombre", "text", { required: true }),
          field("identificacion", "Identificación"),
          field("correo", "Correo", "email"),
          field("telefono", "Teléfono"),
          field("direccion", "Dirección"),
        ]}
        columns={[
          { key: "nombre", label: "Cliente" },
          { key: "identificacion", label: "Identificación" },
          { key: "correo", label: "Correo" },
          { key: "telefono", label: "Teléfono" },
          {
            key: "usuarioId",
            label: "Acceso",
            value: (row) => (row.usuarioId ? "Cuenta vinculada" : "Sin cuenta"),
          },
        ]}
        extraActions={(row) => (
          <>
            {session.can("POST", "/workshop-flow/clientes-acceso") &&
              !row.usuarioId && (
                <Button
                  secondary
                  disabled={action.busy || !row.correo}
                  onClick={() =>
                    action.run(() =>
                      session.mutate("POST", "/workshop-flow/clientes-acceso", {
                        clienteId: row.id,
                      }),
                    )
                  }
                >
                  Dar acceso
                </Button>
              )}
            <Button
              secondary
              onClick={() =>
                session.navigate("vehiculos", { clienteId: row.id })
              }
            >
              Vehículos
            </Button>
          </>
        )}
      />
    </>
  );
}
function Vehicles() {
  const session = useContext(Context),
    own = session.role === "client",
    customers = useRows("CLIENTE", !own),
    source = useData(own ? "/mi/vehiculos" : endpoint("VEHICULO"));
  const [editing, setEditing] = useState(null),
    [mileage, setMileage] = useState(null);
  const fields = [
    ...(!own
      ? [select("clienteId", "Cliente", customers.rows, { required: true })]
      : []),
    field("placa", "Placa", "text", { required: true }),
    field("marca", "Marca"),
    field("modelo", "Modelo"),
    field("anio", "Año", "number", {
      min: 1900,
      max: new Date().getFullYear() + 1,
      step: 1,
    }),
    field("numeroSerie", "VIN / chasis"),
    field("tipoVehiculo", "Tipo de vehículo"),
    field("color", "Color"),
    field("kilometrajeActual", "Kilometraje actual", "number", {
      min: 0,
      step: 1,
    }),
  ];
  return (
    <Panel title={own ? "Mis vehículos" : "Vehículos registrados"}>
      <State source={customers} />
      {session.can("POST", own ? "/mi/vehiculos" : endpoint("VEHICULO")) && (
        <Button
          onClick={() =>
            setEditing({
              clienteId: session.location.query.get("clienteId") || "",
              kilometrajeActual: 0,
            })
          }
        >
          Registrar vehículo
        </Button>
      )}
      <Table
        source={source}
        label="Vehículos"
        columns={[
          { key: "placa", label: "Placa" },
          { key: "marca", label: "Marca" },
          { key: "modelo", label: "Modelo" },
          { key: "numeroSerie", label: "VIN / chasis" },
          { key: "kilometrajeActual", label: "Kilometraje" },
          { key: "color", label: "Color" },
        ]}
        actions={(row) => (
          <>
            <Button
              secondary
              onClick={() =>
                session.navigate("expediente", { vehiculoId: row.id })
              }
            >
              Ver expediente
            </Button>
            {session.can(
              "PUT",
              own ? "/mi/vehiculos/:id" : endpoint("VEHICULO") + "/:id",
            ) && (
              <>
                <Button secondary onClick={() => setEditing(row)}>
                  Editar vehículo
                </Button>
                <Button secondary onClick={() => setMileage(row)}>
                  Actualizar kilometraje
                </Button>
              </>
            )}
          </>
        )}
      />
      {editing && (
        <Dialog title="Vehículo" onClose={() => setEditing(null)}>
          <Form
            title="Datos del vehículo"
            fields={fields}
            initial={editing}
            onSubmit={async (data) => {
              await session.mutate(
                editing.id ? "PUT" : "POST",
                (own ? "/mi/vehiculos" : endpoint("VEHICULO")) +
                  (editing.id ? "/" + editing.id : ""),
                data,
              );
              setEditing(null);
            }}
          />
        </Dialog>
      )}
      {mileage && (
        <Dialog title="Actualizar kilometraje" onClose={() => setMileage(null)}>
          <Form
            title={mileage.placa}
            fields={[
              field("kilometrajeActual", "Kilometraje actual", "number", {
                required: true,
                min: Number(mileage.kilometrajeActual || 0),
                step: 1,
              }),
            ]}
            initial={{ kilometrajeActual: mileage.kilometrajeActual }}
            onSubmit={async (data) => {
              await session.mutate(
                "PUT",
                (own ? "/mi/vehiculos" : endpoint("VEHICULO")) +
                  "/" +
                  mileage.id,
                data,
              );
              setMileage(null);
            }}
          />
        </Dialog>
      )}
    </Panel>
  );
}
function Appointments() {
  const session = useContext(Context),
    action = useAction(),
    own = session.role === "client",
    source = useRows("CITA"),
    vehicles = useData(own ? "/mi/vehiculos" : endpoint("VEHICULO"));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    [day, setDay] = useState(tomorrow),
    slots = useData("/workshop-flow/disponibilidad?fecha=" + day),
    [modal, setModal] = useState(null);
  const available = slots.rows.filter(
      (slot) =>
        slot.disponible &&
        new Date(slot.fecha + "T" + slot.horaInicio + ":00Z") > new Date(),
    ),
    slotOptions = available.map((slot) => ({
      value: slot.id,
      label:
        slot.horaInicio +
        "–" +
        slot.horaFin +
        " · " +
        (slot.capacidad - slot.ocupados) +
        " disponible(s)",
    }));
  return (
    <Panel title="Citas y disponibilidad">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Fecha de atención
          <input
            aria-label="Fecha de atención"
            type="date"
            value={day}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDay(event.target.value)}
            className="ml-2 rounded-lg border p-2"
          />
        </label>
        <Button
          onClick={() => setModal({ kind: "book" })}
          disabled={!available.length || slots.loading || Boolean(slots.error)}
        >
          Solicitar cita
        </Button>
        {session.can("POST", "/workshop-flow/espacios") && (
          <Button secondary onClick={() => setModal({ kind: "slot" })}>
            Definir horario
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-600">
        Horarios en {config.settings.timeZone}. {available.length} espacios
        disponibles para la fecha elegida.
      </p>
      <State source={slots} />
      <State source={vehicles} />
      <Message error>{action.error}</Message>
      <Table
        source={source}
        label="Citas"
        columns={[
          { key: "id", label: "Cita" },
          {
            key: "vehiculoId",
            label: "Vehículo",
            value: (row) =>
              caption(
                vehicles.rows.find(
                  (vehicle) => vehicle.id === row.vehiculoId,
                ) || { id: row.vehiculoId },
              ),
          },
          {
            key: "fechaHora",
            label: "Fecha y hora",
            value: (row) => date(row.fechaHora),
          },
          { key: "motivo", label: "Motivo" },
          { key: "estado", label: "Estado" },
        ]}
        actions={(row) =>
          !["CANCELADA", "RECHAZADA"].includes(row.estado) && (
            <>
              {session.can("POST", "/operations/uc-14/confirmar") &&
                row.estado !== "CONFIRMADA" && (
                  <Button
                    secondary
                    disabled={action.busy}
                    onClick={() =>
                      action.run(() =>
                        session.mutate("POST", "/operations/uc-14/confirmar", {
                          citaId: row.id,
                        }),
                      )
                    }
                  >
                    Confirmar cita
                  </Button>
                )}
              <Button
                secondary
                onClick={() => setModal({ kind: "reschedule", row })}
              >
                Reprogramar
              </Button>
              <Button
                secondary
                onClick={() => setModal({ kind: "cancel", row })}
              >
                Cancelar cita
              </Button>
            </>
          )
        }
      />
      {modal && (
        <Dialog
          title={
            modal.kind === "book"
              ? "Solicitar cita"
              : modal.kind === "slot"
                ? "Definir horario"
                : modal.kind === "cancel"
                  ? "Cancelar cita"
                  : "Reprogramar cita"
          }
          onClose={() => setModal(null)}
        >
          <Form
            title="Datos de la cita"
            fields={
              modal.kind === "slot"
                ? [
                    field("fecha", "Fecha", "date", { required: true }),
                    field("horaInicio", "Hora de inicio", "time", {
                      required: true,
                    }),
                    field("horaFin", "Hora de fin", "time", { required: true }),
                    field("capacidad", "Capacidad", "number", {
                      required: true,
                      min: 1,
                      step: 1,
                    }),
                  ]
                : modal.kind === "cancel"
                  ? []
                  : [
                      ...(modal.kind === "book"
                        ? [
                            select("vehiculoId", "Vehículo", vehicles.rows, {
                              required: true,
                            }),
                            field("motivo", "Motivo", "textarea", {
                              required: true,
                            }),
                          ]
                        : []),
                      field("espacioId", "Espacio disponible", "select", {
                        required: true,
                        options: slotOptions,
                      }),
                    ]
            }
            initial={modal.kind === "slot" ? { fecha: day, capacidad: 1 } : {}}
            submit={
              modal.kind === "cancel" ? "Confirmar cancelación" : "Guardar cita"
            }
            onSubmit={async (data) => {
              await session.mutate(
                "POST",
                modal.kind === "slot"
                  ? "/workshop-flow/espacios"
                  : modal.kind === "book"
                    ? "/workshop-flow/citas"
                    : "/workshop-flow/citas/" +
                      (modal.kind === "cancel" ? "cancelar" : "reprogramar"),
                { ...data, ...(modal.row ? { citaId: modal.row.id } : {}) },
              );
              setModal(null);
            }}
          >
            {modal.kind === "cancel" && (
              <p>
                Se cancelará la cita #{modal.row.id}. El horario quedará
                disponible.
              </p>
            )}
          </Form>
        </Dialog>
      )}
    </Panel>
  );
}
function Intake() {
  const session = useContext(Context),
    vehicles = useRows("VEHICULO"),
    appointments = useRows("CITA"),
    mechanics = useData("/workshop-flow/mecanicos"),
    source = useRows("RECEPCION");
  const [open, setOpen] = useState(false);
  return (
    <Panel title="Recepción e inspección">
      <State source={vehicles} />
      <State source={appointments} />
      <State source={mechanics} />
      <Button onClick={() => setOpen(true)}>Registrar recepción</Button>
      <Table
        source={source}
        label="Recepciones"
        columns={[
          { key: "id", label: "Ingreso" },
          {
            key: "vehiculoId",
            label: "Vehículo",
            value: (row) =>
              caption(
                vehicles.rows.find(
                  (vehicle) => vehicle.id === row.vehiculoId,
                ) || { id: row.vehiculoId },
              ),
          },
          { key: "kilometraje", label: "Kilometraje" },
          {
            key: "nivelCombustible",
            label: "Combustible",
            value: (row) =>
              Math.round(Number(row.nivelCombustible) * 100) + "%",
          },
          { key: "motivoIngreso", label: "Motivo" },
          {
            key: "fechaRecepcion",
            label: "Fecha",
            value: (row) => date(row.fechaRecepcion),
          },
        ]}
        actions={(row) => (
          <Button
            secondary
            onClick={() =>
              session.navigate("expediente", { vehiculoId: row.vehiculoId })
            }
          >
            Ver expediente
          </Button>
        )}
      />
      {open && (
        <Dialog title="Registrar recepción" onClose={() => setOpen(false)}>
          <Form
            title="Inspección de ingreso"
            initial={{ nivelCombustible: 0.5 }}
            fields={[
              select("vehiculoId", "Vehículo", vehicles.rows, {
                required: true,
              }),
              select(
                "citaId",
                "Cita (opcional)",
                appointments.rows.map((row) => ({
                  ...row,
                  nombre:
                    "#" +
                    row.id +
                    " · " +
                    caption(
                      vehicles.rows.find(
                        (vehicle) => vehicle.id === row.vehiculoId,
                      ) || { id: row.vehiculoId },
                    ) +
                    " · " +
                    date(row.fechaHora),
                })),
              ),
              select(
                "mecanicoId",
                "Mecánico inicial (opcional)",
                mechanics.rows,
              ),
              field("kilometraje", "Kilometraje de ingreso", "number", {
                required: true,
                min: 0,
                step: 1,
              }),
              field(
                "nivelCombustible",
                "Combustible (0 vacío, 1 lleno)",
                "number",
                { required: true, min: 0, max: 1, step: 0.25 },
              ),
              field("motivoIngreso", "Motivo de ingreso", "textarea", {
                required: true,
              }),
              field("observaciones", "Observaciones", "textarea"),
              field("fotos", "Fotografías de ingreso", "files"),
            ]}
            onSubmit={async (data) => {
              const { fotos, ...payload } = data;
              const vehicle = vehicles.rows.find(
                  (row) => row.id === payload.vehiculoId,
                ),
                appointment = appointments.rows.find(
                  (row) => row.id === payload.citaId,
                );
              if (appointment && appointment.vehiculoId !== vehicle.id)
                throw new Error(
                  "La cita seleccionada pertenece a otro vehículo.",
                );
              if (payload.kilometraje < Number(vehicle.kilometrajeActual || 0))
                throw new Error("El kilometraje no puede disminuir.");
              await session.mutate("POST", "/workshop-flow/recepcion", {
                ...payload,
                archivoIds: await upload(fotos),
              });
              setOpen(false);
            }}
          />
        </Dialog>
      )}
    </Panel>
  );
}
function ZoneMap({ zones, onChange }) {
  const [state, setState] = useState("REVISION");
  const parts = [
      ["Motor", 110, 45],
      ["Transmisión", 110, 95],
      ["Dirección", 110, 145],
      ["Sistema eléctrico", 110, 195],
      ["Frenos delanteros", 30, 80],
      ["Suspensión", 190, 140],
      ["Frenos traseros", 30, 220],
      ["Carrocería", 110, 270],
    ],
    colors = {
      NORMAL: "#10b981",
      REVISION: "#f59e0b",
      FALLA: "#f97316",
      FALLA_CRITICA: "#e11d48",
    };
  const choose = (name) => {
    if (onChange)
      onChange(
        zones.some((zone) => normalize(zone.zona) === normalize(name))
          ? zones.map((zone) =>
              normalize(zone.zona) === normalize(name)
                ? { ...zone, estado: state }
                : zone,
            )
          : [...zones, { zona: name, estado: state }],
      );
  };
  return (
    <div className="rounded-xl border bg-white p-4">
      {onChange && (
        <label className="text-sm">
          Estado para marcar
          <select
            aria-label="Estado para marcar en el mapa"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="ml-2 rounded-lg border p-2"
          >
            {Object.keys(colors).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <svg
        viewBox="0 0 240 320"
        role={onChange ? "group" : "img"}
        aria-label="Mapa visual de zonas del vehículo"
        className="mx-auto h-80 w-60"
      >
        <rect
          x="55"
          y="10"
          width="130"
          height="300"
          rx="40"
          fill="#f1f5f9"
          stroke="#64748b"
          strokeWidth="3"
        />
        <path
          d="M75 85h90M75 230h90M75 85v145h90V85"
          stroke="#94a3b8"
          fill="none"
        />
        {parts.map(([name, x, y]) => {
          const zone = [...zones]
            .reverse()
            .find((item) => normalize(item.zona) === normalize(name));
          return (
            <g
              key={name}
              role={onChange ? "button" : undefined}
              tabIndex={onChange ? 0 : undefined}
              aria-label={"Marcar zona " + name}
              onClick={() => choose(name)}
              onKeyDown={(event) => {
                if (["Enter", " "].includes(event.key)) {
                  event.preventDefault();
                  choose(name);
                }
              }}
              className={onChange ? "cursor-pointer" : ""}
            >
              <title>{name + ": " + (zone?.estado || "Sin registrar")}</title>
              <circle
                cx={x}
                cy={y}
                r="15"
                fill={colors[zone?.estado] || "#cbd5e1"}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="8"
                fill="#0f172a"
              >
                {name === "Sistema eléctrico"
                  ? "Eléctrico"
                  : name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(colors).map(([value, color]) => (
          <span key={value}>
            <span
              className="mr-1 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {value.replaceAll("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
function Diagnosis() {
  const session = useContext(Context),
    source = useRows("DIAGNOSTICO"),
    intakes = useRows("RECEPCION"),
    vehicles = useRows("VEHICULO"),
    services = useRows("SERVICIO"),
    products = useRows("PRODUCTO");
  const [open, setOpen] = useState(false),
    [lines, setLines] = useState([]),
    [faults, setFaults] = useState([]),
    [zones, setZones] = useState([]);
  return (
    <Panel title="Diagnóstico técnico">
      <State source={intakes} />
      <State source={vehicles} />
      <State source={services} />
      <State source={products} />
      <Button
        onClick={() => {
          setLines([]);
          setFaults([]);
          setZones([]);
          setOpen(true);
        }}
      >
        Nuevo diagnóstico
      </Button>
      <Table
        source={source}
        label="Diagnósticos"
        columns={[
          { key: "id", label: "Diagnóstico" },
          {
            key: "vehiculoId",
            label: "Vehículo",
            value: (row) =>
              caption(
                vehicles.rows.find(
                  (vehicle) => vehicle.id === row.vehiculoId,
                ) || { id: row.vehiculoId },
              ),
          },
          { key: "estado", label: "Estado" },
          { key: "observaciones", label: "Observaciones" },
          {
            key: "codigosObd",
            label: "Códigos OBD",
            value: (row) => (row.codigosObd || []).join(", "),
          },
        ]}
        actions={(row) => (
          <Button
            secondary
            onClick={() =>
              session.navigate("expediente", { vehiculoId: row.vehiculoId })
            }
          >
            Ver expediente
          </Button>
        )}
      />
      {open && (
        <Dialog title="Nuevo diagnóstico" onClose={() => setOpen(false)}>
          <Form
            title="Diagnóstico y evidencia"
            fields={[
              select(
                "recepcionId",
                "Recepción",
                intakes.rows.map((row) => ({
                  ...row,
                  nombre:
                    "#" +
                    row.id +
                    " · " +
                    caption(
                      vehicles.rows.find(
                        (vehicle) => vehicle.id === row.vehiculoId,
                      ) || { id: row.vehiculoId },
                    ),
                })),
                { required: true },
              ),
              field("observaciones", "Observaciones técnicas", "textarea", {
                required: true,
              }),
              field("codigos", "Códigos OBD (separados por coma)"),
              field("fotos", "Fotografías técnicas", "files"),
            ]}
            onSubmit={async (data) => {
              const intake = intakes.rows.find(
                (row) => row.id === data.recepcionId,
              );
              if (!intake) throw new Error("Seleccione una recepción.");
              const codes = String(data.codigos || "")
                .split(",")
                .map((code) => code.trim().toUpperCase())
                .filter(Boolean);
              const payload = {
                recepcionId: intake.id,
                vehiculoId: intake.vehiculoId,
                observaciones: data.observaciones,
                codigosObd: codes,
                fallas: faults,
                zonas: zones,
                archivoIds: await upload(data.fotos),
              };
              if (lines.length) payload.items = payloadLines(lines);
              await session.mutate(
                "POST",
                "/workshop-flow/diagnostico",
                payload,
              );
              setOpen(false);
            }}
          >
            <div className="space-y-3">
              <h3 className="font-semibold">Fallas detectadas</h3>
              {faults.map((fault, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2"
                >
                  {[
                    ["sistema", "Sistema"],
                    ["componente", "Componente"],
                    ["descripcion", "Descripción de falla"],
                  ].map(([key, label]) => (
                    <label className="text-sm" key={key}>
                      {label}
                      <input
                        aria-label={`${label} ${index + 1}`}
                        required={key === "sistema"}
                        value={fault[key]}
                        onChange={(event) =>
                          setFaults(
                            faults.map((row, i) =>
                              i === index
                                ? { ...row, [key]: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full rounded-lg border p-2"
                      />
                    </label>
                  ))}
                  <label className="text-sm">
                    Severidad
                    <select
                      value={fault.severidad}
                      onChange={(event) =>
                        setFaults(
                          faults.map((row, i) =>
                            i === index
                              ? { ...row, severidad: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    >
                      {["BAJA", "MEDIA", "ALTA", "CRITICA"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    secondary
                    onClick={() =>
                      setFaults(faults.filter((_, i) => i !== index))
                    }
                  >
                    Quitar falla {index + 1}
                  </Button>
                </div>
              ))}
              <Button
                secondary
                onClick={() =>
                  setFaults([
                    ...faults,
                    {
                      sistema: "",
                      componente: "",
                      descripcion: "",
                      severidad: "MEDIA",
                    },
                  ])
                }
              >
                Agregar falla
              </Button>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Mapa de zonas</h3>
              <ZoneMap zones={zones} onChange={setZones} />
              {zones.map((zone, index) => (
                <div key={index} className="flex flex-wrap gap-2">
                  <label>
                    Zona
                    <input
                      aria-label={`Zona ${index + 1}`}
                      required
                      value={zone.zona}
                      onChange={(event) =>
                        setZones(
                          zones.map((row, i) =>
                            i === index
                              ? { ...row, zona: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="ml-2 rounded-lg border p-2"
                    />
                  </label>
                  <label>
                    Estado de zona
                    <select
                      value={zone.estado}
                      onChange={(event) =>
                        setZones(
                          zones.map((row, i) =>
                            i === index
                              ? { ...row, estado: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="ml-2 rounded-lg border p-2"
                    >
                      {["NORMAL", "REVISION", "FALLA", "FALLA_CRITICA"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <Button
                    secondary
                    onClick={() =>
                      setZones(zones.filter((_, i) => i !== index))
                    }
                  >
                    Quitar zona {index + 1}
                  </Button>
                </div>
              ))}
              <Button
                secondary
                onClick={() =>
                  setZones([...zones, { zona: "", estado: "NORMAL" }])
                }
              >
                Agregar zona
              </Button>
            </div>
            <Lines
              services={services.rows}
              products={products.rows}
              value={lines}
              onChange={setLines}
            />
            <p className="text-sm text-slate-600">
              Los conceptos agregados se guardarán en una cotización para
              revisión del cliente.
            </p>
          </Form>
        </Dialog>
      )}
    </Panel>
  );
}
function Quotes() {
  const session = useContext(Context),
    source = useData("/workshop-flow/cotizaciones"),
    vehicles = useData(
      session.role === "client" ? "/mi/vehiculos" : endpoint("VEHICULO"),
    ),
    services = useRows("SERVICIO", session.role !== "client"),
    products = useRows("PRODUCTO", session.role !== "client");
  const [modal, setModal] = useState(null),
    [lines, setLines] = useState([]),
    [selected, setSelected] = useState([]);
  return (
    <Panel
      title={
        session.role === "client"
          ? "Mis cotizaciones"
          : "Cotizaciones y autorizaciones"
      }
    >
      {session.role !== "client" && (
        <Button
          onClick={() => {
            setLines([]);
            setModal({ kind: "new" });
          }}
        >
          Nueva cotización
        </Button>
      )}
      <State source={vehicles} />
      <State source={services} />
      <State source={products} />
      <Table
        source={source}
        label="Cotizaciones"
        columns={[
          { key: "id", label: "Cotización" },
          {
            key: "vehiculoId",
            label: "Vehículo",
            value: (row) =>
              caption(
                vehicles.rows.find(
                  (vehicle) => vehicle.id === row.vehiculoId,
                ) || { id: row.vehiculoId },
              ),
          },
          { key: "estado", label: "Estado" },
          { key: "total", label: "Total", value: (row) => money(row.total) },
          {
            key: "fechaVencimiento",
            label: "Vigencia",
            value: (row) =>
              row.fechaVencimiento
                ? date(row.fechaVencimiento)
                : "Sin vencimiento configurado",
          },
        ]}
        actions={(row) => (
          <>
            <Button
              secondary
              onClick={() => {
                setSelected((row.items || []).map((item) => item.id));
                setModal({ kind: "detail", row });
              }}
            >
              Ver conceptos
            </Button>
            {session.can("POST", "/workshop-flow/decision") &&
              row.estado === "PENDIENTE" && (
                <Button
                  onClick={() => {
                    setSelected((row.items || []).map((item) => item.id));
                    setModal({ kind: "decision", row });
                  }}
                >
                  Autorizar o rechazar
                </Button>
              )}
          </>
        )}
      />
      {modal && (
        <Dialog
          title={
            modal.kind === "new"
              ? "Nueva cotización"
              : `Cotización #${modal.row.id}`
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "new" ? (
            <Form
              title="Elaborar cotización"
              fields={[
                select("vehiculoId", "Vehículo", vehicles.rows, {
                  required: true,
                }),
              ]}
              onSubmit={async (data) => {
                const vehicle = vehicles.rows.find(
                  (row) => row.id === data.vehiculoId,
                );
                await session.mutate("POST", config.operations.quote.path, {
                  ...data,
                  clienteId: vehicle.clienteId,
                  items: payloadLines(lines),
                });
                setModal(null);
              }}
            >
              <Lines
                services={services.rows}
                products={products.rows}
                value={lines}
                onChange={setLines}
              />
            </Form>
          ) : (
            <>
              <Table
                rows={modal.row.items || []}
                label="Conceptos cotizados"
                columns={[
                  { key: "descripcion", label: "Concepto" },
                  { key: "cantidad", label: "Cantidad" },
                  {
                    key: "precioUnitario",
                    label: "Precio",
                    value: (row) => money(row.precioUnitario),
                  },
                  {
                    key: "impuesto",
                    label: "Impuesto",
                    value: (row) => money(row.impuesto),
                  },
                  {
                    key: "totalLinea",
                    label: "Importe",
                    value: (row) => money(row.totalLinea),
                  },
                  { key: "estadoAprobacion", label: "Autorización" },
                ]}
                actions={
                  modal.kind === "decision"
                    ? (row) => (
                        <label>
                          Aceptar concepto {row.id}
                          <input
                            type="checkbox"
                            className="ml-2"
                            checked={selected.includes(row.id)}
                            onChange={(event) =>
                              setSelected(
                                event.target.checked
                                  ? [...selected, row.id]
                                  : selected.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </label>
                      )
                    : undefined
                }
              />
              <p className="my-3 font-semibold">
                Subtotal: {money(modal.row.subtotal)} · Impuestos:{" "}
                {money(modal.row.impuestos)} · Total: {money(modal.row.total)}
              </p>
              {modal.kind === "decision" && (
                <Form
                  title="Decisión del cliente"
                  fields={[
                    field("decision", "Decisión", "select", {
                      required: true,
                      numeric: false,
                      options: [
                        { value: "APROBAR", label: "Aprobar todo" },
                        {
                          value: "APROBAR_PARCIAL",
                          label: "Aprobar solo conceptos seleccionados",
                        },
                        { value: "RECHAZAR", label: "Rechazar cotización" },
                      ],
                    }),
                    field("observaciones", "Observaciones", "textarea"),
                  ]}
                  initial={{ decision: "APROBAR" }}
                  submit="Registrar decisión"
                  onSubmit={async (data) => {
                    if (data.decision === "APROBAR_PARCIAL" && !selected.length)
                      throw new Error("Seleccione al menos un concepto.");
                    await session.mutate("POST", "/workshop-flow/decision", {
                      ...data,
                      cotizacionId: modal.row.id,
                      itemsAceptados: selected,
                    });
                    setModal(null);
                  }}
                />
              )}
            </>
          )}
        </Dialog>
      )}
    </Panel>
  );
}
const phases = {
  CREADA: ["EN_DIAGNOSTICO", "EN_REPARACION", "EN_PROCESO", "CANCELADA"],
  ABIERTA: ["EN_DIAGNOSTICO", "EN_PROCESO", "CANCELADA"],
  EN_DIAGNOSTICO: ["EN_REPARACION", "EN_PROCESO", "CANCELADA"],
  EN_PROCESO: ["EN_REPARACION", "EN_PRUEBAS", "FINALIZADA"],
  EN_REPARACION: ["EN_PRUEBAS", "FINALIZADA"],
  EN_PRUEBAS: ["EN_REPARACION", "LAVADO", "FINALIZADA"],
  LAVADO: ["FINALIZADA"],
  FINALIZADA: ["ENTREGADA"],
};
function Orders() {
  const session = useContext(Context),
    source = useData("/workshop-flow/ordenes"),
    quotes = useData(
      session.role === "reception" ? "/workshop-flow/cotizaciones" : null,
    ),
    mechanics = useData(
      session.role === "reception" ? "/workshop-flow/mecanicos" : null,
    ),
    products = useRows("PRODUCTO", session.role !== "client");
  const [modal, setModal] = useState(null),
    [lines, setLines] = useState([]);
  const approved = quotes.rows.filter(
    (row) =>
      ["APROBADA", "APROBADA_PARCIALMENTE", "APROBADA_PARCIAL"].includes(
        row.estado,
      ) && !source.rows.some((order) => order.cotizacionId === row.id),
  );
  return (
    <Panel
      title={
        session.role === "client"
          ? "Avance de mis reparaciones"
          : "Órdenes de trabajo y reparación"
      }
    >
      {session.role === "reception" && (
        <Button onClick={() => setModal({ kind: "new" })}>
          Crear orden autorizada
        </Button>
      )}
      <State source={quotes} />
      <State source={mechanics} />
      <State source={products} />
      <Table
        source={source}
        label="Órdenes de trabajo"
        columns={[
          { key: "id", label: "Orden" },
          { key: "placa", label: "Placa" },
          { key: "estado", label: "Fase" },
          { key: "kilometraje", label: "Kilometraje" },
          {
            key: "fechaApertura",
            label: "Apertura",
            value: (row) => date(row.fechaApertura),
          },
        ]}
        actions={(row) => (
          <>
            <Button secondary onClick={() => setModal({ kind: "detail", row })}>
              Ver reparación
            </Button>
            {session.role === "reception" &&
              !["FINALIZADA", "ENTREGADA", "CANCELADA"].includes(
                row.estado,
              ) && (
                <Button
                  secondary
                  onClick={() => setModal({ kind: "assign", row })}
                >
                  Asignar mecánicos
                </Button>
              )}
            {session.role !== "client" &&
              !["FINALIZADA", "ENTREGADA", "CANCELADA"].includes(
                row.estado,
              ) && (
                <Button
                  secondary
                  onClick={() => {
                    setLines([]);
                    setModal({ kind: "consume", row });
                  }}
                >
                  Registrar actividad y consumo
                </Button>
              )}
            {session.role !== "client" &&
              (phases[row.estado] || []).length > 0 && (
                <Button onClick={() => setModal({ kind: "phase", row })}>
                  Cambiar fase
                </Button>
              )}
          </>
        )}
      />
      {modal && (
        <Dialog
          title={
            modal.kind === "new"
              ? "Crear orden autorizada"
              : `Orden #${modal.row.id}`
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "detail" ? (
            <div className="space-y-4">
              <p className="font-semibold">
                {modal.row.placa} · {modal.row.estado}
              </p>
              <Table
                rows={modal.row.actividades || []}
                label="Bitácora"
                columns={[
                  { key: "actividadRealizada", label: "Actividad" },
                  { key: "pruebasEfectuadas", label: "Pruebas efectuadas" },
                  { key: "usuarioId", label: "Responsable" },
                  {
                    key: "fechaRegistro",
                    label: "Fecha",
                    value: (row) => date(row.fechaRegistro),
                  },
                  {
                    key: "productoId",
                    label: "Repuesto",
                    value: (row) =>
                      caption(
                        products.rows.find(
                          (product) => product.id === row.productoId,
                        ) || { id: row.productoId },
                      ),
                  },
                  { key: "cantidad", label: "Cantidad prevista" },
                  { key: "stockDescontado", label: "Cantidad consumida" },
                ]}
              />
              <div className="flex flex-wrap gap-3">
                {(modal.row.evidencias || []).map((item) => (
                  <PrivatePhoto key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <Form
              title={
                modal.kind === "new"
                  ? "Autorización de origen"
                  : modal.kind === "assign"
                    ? "Asignación de mecánicos"
                    : modal.kind === "phase"
                      ? "Cambio de fase"
                      : "Actividad y repuestos utilizados"
              }
              fields={
                modal.kind === "new"
                  ? [
                      select(
                        "cotizacionId",
                        "Cotización autorizada",
                        approved.map((row) => ({
                          ...row,
                          nombre:
                            "#" +
                            row.id +
                            " · vehículo #" +
                            row.vehiculoId +
                            " · " +
                            money(row.total),
                        })),
                        { required: true },
                      ),
                    ]
                  : modal.kind === "assign"
                    ? [
                        field("mecanicoIds", "Mecánicos", "multiple", {
                          required: true,
                          options: options(mechanics.rows),
                          help: "Puede seleccionar varios mecánicos.",
                        }),
                      ]
                    : modal.kind === "phase"
                      ? [
                          field("fase", "Nueva fase", "select", {
                            required: true,
                            numeric: false,
                            options: (phases[modal.row.estado] || [])
                              .filter(
                                (phase) =>
                                  !["ENTREGADA", "CANCELADA"].includes(phase) ||
                                  session.role !== "mechanic",
                              )
                              .map((value) => ({
                                value,
                                label: value.replaceAll("_", " "),
                              })),
                          }),
                        ]
                      : [
                          field(
                            "actividadRealizada",
                            "Actividad realizada",
                            "textarea",
                          ),
                          field("observaciones", "Observaciones", "textarea"),
                          field(
                            "pruebasEfectuadas",
                            "Pruebas efectuadas",
                            "textarea",
                          ),
                        ]
              }
              submit={
                modal.kind === "new"
                  ? "Crear orden"
                  : modal.kind === "consume"
                    ? "Guardar actividad y consumo"
                    : "Guardar"
              }
              onSubmit={async (data, key) => {
                if (modal.kind === "new")
                  await session.mutate("POST", "/workshop-flow/ordenes", data);
                else if (modal.kind === "assign") {
                  if (!data.mecanicoIds?.length)
                    throw new Error("Seleccione un mecánico.");
                  await session.mutate(
                    "POST",
                    "/workshop-flow/ordenes/mecanicos",
                    { ...data, ordenId: modal.row.id },
                  );
                } else if (modal.kind === "phase")
                  await session.mutate("POST", "/workshop-flow/fase", {
                    ...data,
                    ordenId: modal.row.id,
                  });
                else {
                  if (!lines.length && !data.actividadRealizada)
                    throw new Error(
                      "Documente la actividad o agregue un repuesto utilizado.",
                    );
                  await session.mutate(
                    "POST",
                    "/workshop-flow/ordenes/consumo",
                    {
                      ...data,
                      ordenId: modal.row.id,
                      items: lines.length ? payloadLines(lines, "consume") : [],
                      claveOperacion: key,
                    },
                  );
                }
                setModal(null);
              }}
            >
              {modal.kind === "consume" && (
                <>
                  <Lines
                    kind="consume"
                    products={products.rows}
                    value={lines}
                    onChange={setLines}
                  />
                  <p className="text-sm text-slate-600">
                    Los repuestos indicados se descontarán al guardar. Al
                    finalizar la orden solo se descontará lo que quede
                    pendiente.
                  </p>
                </>
              )}
            </Form>
          )}
        </Dialog>
      )}
    </Panel>
  );
}
function Products() {
  const session = useContext(Context),
    [product, setProduct] = useState(null),
    alerts = useRows("ALERTASTOCK");
  return (
    <>
      <Catalog
        name="PRODUCTO"
        title="Repuesto"
        initial={{
          activo: true,
          costo: 0,
          precio: 0,
          existencias: 0,
          stockMinimo: 0,
        }}
        fields={[
          field("codigo", "Código", "text", { required: true }),
          field("nombre", "Nombre", "text", { required: true }),
          field("categoria", "Categoría"),
          field("marca", "Marca"),
          field("costo", "Costo", "number", { required: true, min: 0 }),
          field("precio", "Precio", "number", { required: true, min: 0 }),
          field("existencias", "Existencias", "number", {
            required: true,
            min: 0,
          }),
          field("stockMinimo", "Stock mínimo", "number", {
            required: true,
            min: 0,
          }),
          field("activo", "Activo", "checkbox"),
        ]}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "nombre", label: "Repuesto" },
          { key: "existencias", label: "Existencias" },
          { key: "stockMinimo", label: "Mínimo" },
          { key: "precio", label: "Precio", value: (row) => money(row.precio) },
          { key: "activo", label: "Activo" },
        ]}
        extraActions={(row) =>
          session.can("POST", "/inventario/movimientos") && (
            <Button secondary onClick={() => setProduct(row)}>
              Ajustar existencias
            </Button>
          )
        }
      />
      <Panel title="Alertas de inventario">
        <Table
          source={alerts}
          label="Alertas de stock"
          columns={[
            { key: "productoId", label: "Repuesto" },
            { key: "existenciasActuales", label: "Existencias" },
            { key: "stockMinimo", label: "Mínimo" },
            { key: "estado", label: "Estado" },
            {
              key: "fechaGeneracion",
              label: "Fecha",
              value: (row) => date(row.fechaGeneracion),
            },
          ]}
        />
      </Panel>
      {product && (
        <Dialog
          title={"Ajustar " + product.nombre}
          onClose={() => setProduct(null)}
        >
          <Form
            title="Movimiento de inventario"
            fields={[
              field("variacion", "Variación (+ entrada, − salida)", "number", {
                required: true,
              }),
              field("motivo", "Motivo", "textarea", { required: true }),
            ]}
            onSubmit={async (data, key) => {
              if (data.variacion === 0)
                throw new Error("La variación debe ser distinta de cero.");
              await session.mutate("POST", "/inventario/movimientos", {
                ...data,
                productoId: product.id,
                claveOperacion: key,
              });
              setProduct(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
function Commerce({ purchase = false }) {
  const session = useContext(Context),
    source = useRows(purchase ? "COMPRA" : "VENTA"),
    contacts = useRows(purchase ? "PROVEEDOR" : "CLIENTE"),
    products = useRows("PRODUCTO");
  const details = useRows(purchase ? "COMPRADETALLE" : "VENTADETALLE"),
    [receipt, setReceipt] = useState(null);
  const [open, setOpen] = useState(false),
    [lines, setLines] = useState([]);
  return (
    <div className="space-y-5">
      <Panel title={purchase ? "Compras de inventario" : "Ventas de mostrador"}>
        <State source={contacts} />
        <State source={products} />
        {session.can(
          "POST",
          purchase ? "/workshop-flow/compras" : "/workshop-flow/venta",
        ) && (
          <Button
            onClick={() => {
              setLines([]);
              setOpen(true);
            }}
          >
            {purchase ? "Registrar compra e ingreso" : "Nueva venta"}
          </Button>
        )}
        <Table
          source={source}
          label={purchase ? "Compras" : "Ventas"}
          columns={[
            { key: "id", label: purchase ? "Compra" : "Venta" },
            {
              key: purchase ? "proveedorId" : "clienteId",
              label: purchase ? "Proveedor" : "Cliente",
              value: (row) =>
                caption(
                  contacts.rows.find(
                    (contact) =>
                      contact.id ===
                      row[purchase ? "proveedorId" : "clienteId"],
                  ) || { id: row[purchase ? "proveedorId" : "clienteId"] },
                ),
            },
            { key: "numeroDocumento", label: "Documento" },
            { key: "total", label: "Total", value: (row) => money(row.total) },
            {
              key: purchase ? "fechaCompra" : "fechaVenta",
              label: "Fecha",
              value: (row) =>
                date(row[purchase ? "fechaCompra" : "fechaVenta"]),
            },
            ...(purchase ? [{ key: "estado", label: "Estado" }] : []),
          ]}
          actions={(row) => (
            <Button secondary onClick={() => setReceipt(row)}>
              Ver detalle
            </Button>
          )}
        />
        {receipt && (
          <Dialog
            title={(purchase ? "Compra #" : "Venta #") + receipt.id}
            onClose={() => setReceipt(null)}
          >
            <p className="mb-3">
              Documento: {receipt.numeroDocumento || "Sin número"} ·{" "}
              {date(receipt[purchase ? "fechaCompra" : "fechaVenta"])}
            </p>
            <Table
              source={{
                ...details,
                rows: details.rows.filter(
                  (row) =>
                    row[purchase ? "compraId" : "ventaId"] === receipt.id,
                ),
              }}
              label="Detalle del documento"
              columns={[
                {
                  key: "productoId",
                  label: "Producto",
                  value: (row) =>
                    caption(
                      products.rows.find(
                        (product) => product.id === row.productoId,
                      ) || { id: row.productoId },
                    ),
                },
                { key: "cantidad", label: "Cantidad" },
                {
                  key: purchase ? "costoUnitario" : "precioUnitario",
                  label: "Valor unitario",
                  value: (row) =>
                    money(row[purchase ? "costoUnitario" : "precioUnitario"]),
                },
                {
                  key: "totalLinea",
                  label: "Importe",
                  value: (row) => money(row.totalLinea),
                },
              ]}
            />
            <p className="my-4 font-bold">
              Total confirmado: {money(receipt.total)}
            </p>
            <Button secondary onClick={() => window.print()}>
              Imprimir documento
            </Button>
          </Dialog>
        )}
        {open && (
          <Dialog
            title={purchase ? "Registrar compra" : "Nueva venta"}
            onClose={() => setOpen(false)}
          >
            <Form
              title={
                purchase
                  ? "Compra e ingreso de inventario"
                  : "Venta de mostrador"
              }
              fields={[
                select(
                  purchase ? "proveedorId" : "clienteId",
                  purchase ? "Proveedor" : "Cliente",
                  contacts.rows,
                  { required: true },
                ),
                field("numeroDocumento", "Número de documento"),
              ]}
              submit={
                purchase
                  ? "Confirmar compra e ingresar stock"
                  : "Confirmar venta"
              }
              onSubmit={async (data, key) => {
                const items = payloadLines(
                  lines,
                  purchase ? "purchase" : "quote",
                ).map((item) =>
                  purchase
                    ? item
                    : {
                        productoId: item.productoId,
                        cantidad: item.cantidad,
                        precioUnitario: item.precioUnitario,
                        impuesto: item.impuesto || 0,
                      },
                );
                await session.mutate(
                  "POST",
                  purchase ? "/workshop-flow/compras" : "/workshop-flow/venta",
                  { ...data, items, claveOperacion: key },
                );
                setOpen(false);
              }}
            >
              <Lines
                kind={purchase ? "purchase" : "sale"}
                products={products.rows}
                value={lines}
                onChange={setLines}
              />
              <p className="text-sm text-slate-600">
                {purchase
                  ? "Al confirmar, los productos ingresarán al inventario."
                  : "La venta descontará las existencias. El servidor confirmará el total."}
              </p>
            </Form>
          </Dialog>
        )}
      </Panel>
      {purchase && (
        <Catalog
          name="PROVEEDOR"
          title="Proveedor"
          fields={[
            field("nombre", "Nombre", "text", { required: true }),
            field("identificacion", "Identificación", "text", {
              required: true,
            }),
            field("correo", "Correo", "email"),
            field("telefono", "Teléfono"),
            field("direccion", "Dirección"),
          ]}
          columns={[
            { key: "nombre", label: "Proveedor" },
            { key: "identificacion", label: "Identificación" },
            { key: "correo", label: "Correo" },
            { key: "telefono", label: "Teléfono" },
          ]}
        />
      )}
    </div>
  );
}
function Accounts() {
  const session = useContext(Context),
    source = useRows("USUARIO"),
    roles = useRows("ROL"),
    action = useAction();
  const [modal, setModal] = useState(null);
  return (
    <Panel title="Usuarios">
      <State source={roles} />
      <Message error>{action.error}</Message>
      <Button onClick={() => setModal({ kind: "new" })}>Nuevo usuario</Button>
      <Table
        source={source}
        label="Usuarios"
        columns={[
          { key: "nombre", label: "Nombre" },
          { key: "correo", label: "Correo" },
          {
            key: "rolId",
            label: "Rol",
            value: (row) =>
              roles.rows.find((role) => role.id === row.rolId)?.nombre ||
              "Sin rol",
          },
          { key: "estado", label: "Estado" },
          { key: "cambioObligatorio", label: "Cambio de clave pendiente" },
        ]}
        actions={(row) => (
          <>
            <Button secondary onClick={() => setModal({ kind: "edit", row })}>
              Editar usuario
            </Button>
            <Button secondary onClick={() => setModal({ kind: "reset", row })}>
              Generar clave temporal
            </Button>
          </>
        )}
      />
      {modal && (
        <Dialog
          title={
            modal.kind === "new"
              ? "Nuevo usuario"
              : modal.kind === "reset"
                ? "Generar clave temporal"
                : "Editar usuario"
          }
          onClose={() => setModal(null)}
        >
          <Form
            title="Cuenta de acceso"
            fields={
              modal.kind === "reset"
                ? []
                : [
                    field("nombre", "Nombre", "text", { required: true }),
                    field("correo", "Correo", "email", { required: true }),
                    field(
                      modal.kind === "new" ? "rol" : "rolId",
                      "Rol",
                      "select",
                      {
                        required: true,
                        numeric: modal.kind !== "new",
                        options: roles.rows.map((row) => ({
                          value: modal.kind === "new" ? row.nombre : row.id,
                          label: row.nombre,
                        })),
                      },
                    ),
                    ...(modal.kind === "edit"
                      ? [
                          field("estado", "Estado", "select", {
                            required: true,
                            numeric: false,
                            options: [
                              { value: "ACTIVO", label: "Activo" },
                              { value: "INACTIVO", label: "Inactivo" },
                            ],
                          }),
                        ]
                      : []),
                  ]
            }
            initial={modal.row || {}}
            submit={
              modal.kind === "reset"
                ? "Generar clave temporal"
                : "Guardar usuario"
            }
            onSubmit={async (data) => {
              await session.mutate(
                modal.kind === "edit" ? "PUT" : "POST",
                modal.kind === "new"
                  ? "/workshop-flow/usuarios"
                  : modal.kind === "reset"
                    ? "/workshop-flow/usuarios/" + modal.row.id + "/clave"
                    : endpoint("USUARIO") + "/" + modal.row.id,
                data,
              );
              setModal(null);
            }}
          >
            {modal.kind === "new" && (
              <p>
                Se generará una clave temporal que se mostrará una sola vez. El
                usuario deberá cambiarla al entrar.
              </p>
            )}
            {modal.kind === "reset" && (
              <p>
                Se revocarán las sesiones de {modal.row.correo} y se generará
                una nueva clave temporal.
              </p>
            )}
          </Form>
        </Dialog>
      )}
    </Panel>
  );
}
function Permissions() {
  const session = useContext(Context),
    source = useData("/workshop-flow/permisos"),
    action = useAction();
  const data = source.data || {},
    roles = data.roles || [],
    permissions = data.permisos || [],
    assignments = data.asignaciones || [];
  return (
    <Panel title="Roles y permisos">
      <State source={source} />
      <Message error>{action.error}</Message>
      <p className="text-sm text-slate-600">
        Cada cambio se guarda y se aplica en el servidor. Los controles de
        propietario y las precondiciones del proceso siguen siendo obligatorios.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Permisos por rol">
          <thead>
            <tr>
              <th className="p-3 text-left">Permiso</th>
              {roles.map((role) => (
                <th key={role.id} className="p-3">
                  {role.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-t">
                <td className="p-3">
                  {config.permissionLabels[permission.codigo] ||
                    permission.codigo}
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="p-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${config.permissionLabels[permission.codigo] || permission.codigo} · ${role.nombre}`}
                      checked={assignments.some(
                        (item) =>
                          item.rolId === role.id &&
                          item.permisoId === permission.id,
                      )}
                      disabled={action.busy}
                      onChange={(event) =>
                        action.run(() =>
                          session.mutate("POST", "/workshop-flow/permisos", {
                            rol: role.nombre,
                            codigo: permission.codigo,
                            concedido: event.target.checked,
                          }),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function History() {
  const session = useContext(Context),
    vehicles = useData(
      session.role === "client" ? "/mi/vehiculos" : endpoint("VEHICULO"),
    );
  const [selected, setSelected] = useState(
      session.location.query.get("vehiculoId") || "",
    ),
    history = useData(
      selected ? "/workshop-flow/expediente?vehiculoId=" + selected : null,
    );
  const data = history.data || {};
  return (
    <Panel title="Expediente e historial del vehículo">
      <State source={vehicles} />
      <label className="block text-sm">
        Vehículo
        <select
          aria-label="Vehículo del expediente"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="ml-2 rounded-lg border p-2"
        >
          <option value="">Seleccione…</option>
          {vehicles.rows.map((row) => (
            <option value={row.id} key={row.id}>
              {caption(row)}
            </option>
          ))}
        </select>
      </label>
      <State source={history} />
      {!selected && <p>Seleccione un vehículo para consultar su expediente.</p>}
      {data.vehiculo && (
        <>
          <p className="font-semibold">
            {caption(data.vehiculo)} ·{" "}
            {data.vehiculo.kilometrajeActual ?? "Sin registro"} km · VIN{" "}
            {data.vehiculo.numeroSerie || "Sin registro"}
          </p>
          <Table
            rows={(data.historial || []).map((row, i) => ({
              ...row,
              id: "history-" + i,
              detalle:
                row.detalle ||
                (row.contenido?.ordenTrabajoId
                  ? "Orden #" + row.contenido.ordenTrabajoId
                  : ""),
            }))}
            label="Historial del vehículo"
            columns={[
              { key: "fecha", label: "Fecha", value: (row) => date(row.fecha) },
              { key: "tipo", label: "Tipo" },
              { key: "kilometraje", label: "Kilometraje" },
              { key: "detalle", label: "Detalle" },
            ]}
          />
          <Panel title="Diagnósticos">
            <Table
              rows={data.diagnosticos || []}
              label="Diagnósticos del expediente"
              columns={[
                { key: "id", label: "Diagnóstico" },
                { key: "observaciones", label: "Observaciones" },
                {
                  key: "codigosObd",
                  label: "OBD",
                  value: (row) => (row.codigosObd || []).join(", "),
                },
                { key: "estado", label: "Estado" },
              ]}
            />
          </Panel>
          <Panel title="Reparaciones">
            <Table
              rows={data.ordenes || []}
              label="Órdenes del expediente"
              columns={[
                { key: "id", label: "Orden" },
                { key: "estado", label: "Estado" },
                {
                  key: "fechaApertura",
                  label: "Apertura",
                  value: (row) => date(row.fechaApertura),
                },
                {
                  key: "fechaCierre",
                  label: "Cierre",
                  value: (row) => date(row.fechaCierre),
                },
              ]}
            />
          </Panel>
          <Panel title="Fallas y zonas diagnosticadas">
            <Table
              rows={data.fallas || []}
              label="Fallas del expediente"
              columns={[
                { key: "sistema", label: "Sistema" },
                { key: "componente", label: "Componente" },
                { key: "descripcion", label: "Falla" },
                { key: "severidad", label: "Severidad" },
              ]}
            />
            <ZoneMap zones={data.zonas || []} />
            <Table
              rows={data.zonas || []}
              label="Zonas del expediente"
              columns={[
                { key: "zona", label: "Zona" },
                { key: "estado", label: "Estado" },
              ]}
            />
          </Panel>
          <Panel title="Evidencias">
            <div className="flex flex-wrap gap-3">
              {(data.evidencias || []).map((item) => (
                <PrivatePhoto key={item.id} item={item} />
              ))}
            </div>
            {!data.evidencias?.length && <p>No hay evidencias registradas.</p>}
          </Panel>
          <Panel title="Avisos de mantenimiento">
            <Table
              rows={data.mantenimientos || []}
              label="Mantenimientos del vehículo"
              columns={[
                { key: "reglaMantenimientoId", label: "Regla" },
                { key: "estado", label: "Estado" },
                {
                  key: "fechaGeneracion",
                  label: "Generado",
                  value: (row) => date(row.fechaGeneracion),
                },
              ]}
            />
          </Panel>
        </>
      )}
    </Panel>
  );
}
function Maintenance() {
  const session = useContext(Context),
    vehicles = useRows("VEHICULO"),
    notices = useRows("AVISOMANTENIMIENTO"),
    action = useAction();
  return (
    <div className="space-y-5">
      <Message error>{action.error}</Message>
      {session.role === "admin" && (
        <Catalog
          name="REGLAMANTENIMIENTO"
          createLabel="Nueva regla de mantenimiento"
          title="Regla de mantenimiento"
          initial={{ activo: true }}
          fields={[
            field("nombre", "Nombre", "text", { required: true }),
            field("descripcion", "Descripción", "textarea"),
            select("vehiculoId", "Vehículo (opcional)", vehicles.rows),
            field("tipoVehiculo", "Tipo de vehículo (si no elige vehículo)"),
            field("intervaloDias", "Intervalo en días", "number", {
              min: 0,
              step: 1,
            }),
            field("intervaloKilometros", "Intervalo en kilómetros", "number", {
              min: 0,
              step: 1,
            }),
            field("anticipacionDias", "Anticipación en días", "number", {
              min: 0,
              step: 1,
            }),
            field(
              "anticipacionKilometros",
              "Anticipación en kilómetros",
              "number",
              { min: 0, step: 1 },
            ),
            field("activo", "Activa", "checkbox"),
          ]}
          columns={[
            { key: "nombre", label: "Regla" },
            { key: "vehiculoId", label: "Vehículo" },
            { key: "tipoVehiculo", label: "Tipo" },
            { key: "intervaloDias", label: "Días" },
            { key: "intervaloKilometros", label: "Kilómetros" },
            { key: "activo", label: "Activa" },
          ]}
        />
      )}
      <Panel title="Avisos preventivos">
        {session.can("POST", config.operations.maintenanceEvaluate.path) && (
          <Button
            disabled={action.busy}
            onClick={() =>
              action.run(() =>
                session.mutate(
                  "POST",
                  config.operations.maintenanceEvaluate.path,
                  {},
                ),
              )
            }
          >
            Evaluar mantenimientos
          </Button>
        )}
        <Table
          source={notices}
          label="Avisos de mantenimiento"
          columns={[
            {
              key: "vehiculoId",
              label: "Vehículo",
              value: (row) =>
                caption(
                  vehicles.rows.find(
                    (vehicle) => vehicle.id === row.vehiculoId,
                  ) || { id: row.vehiculoId },
                ),
            },
            { key: "reglaMantenimientoId", label: "Regla" },
            { key: "estado", label: "Estado" },
            {
              key: "fechaGeneracion",
              label: "Generado",
              value: (row) => date(row.fechaGeneracion),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
const knowledgeFields = [
  field("codigoObd", "Código OBD", "text", { required: true }),
  field("sintoma", "Síntoma"),
  field("componente", "Componente"),
  field("descripcion", "Descripción", "textarea"),
  field("causa", "Causa", "textarea"),
  field("solucion", "Solución", "textarea"),
  field("casoResuelto", "Caso resuelto", "select", {
    numeric: false,
    options: [
      { value: "NO", label: "No" },
      { value: "SI", label: "Sí" },
    ],
  }),
];
function Knowledge() {
  const session = useContext(Context),
    [query, setQuery] = useState(""),
    source = useData(
      endpoint("OBDCONOCIMIENTO") +
        (query ? "?q=" + encodeURIComponent(query) : ""),
    ),
    proposals = useData("/workshop-flow/obd/propuestas"),
    action = useAction();
  const [modal, setModal] = useState(null);
  return (
    <Panel title="Conocimiento técnico OBD">
      <label className="block text-sm">
        Buscar código, síntoma o componente
        <input
          aria-label="Buscar conocimiento"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="ml-2 rounded-lg border p-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setModal({ kind: "new" })}>
          Nuevo artículo técnico
        </Button>
        <Button secondary onClick={() => setModal({ kind: "proposal" })}>
          Proponer solución
        </Button>
      </div>
      <Message error>{action.error}</Message>
      <Table
        source={source}
        label="Conocimiento técnico"
        columns={[
          { key: "codigoObd", label: "OBD" },
          { key: "sintoma", label: "Síntoma" },
          { key: "componente", label: "Componente" },
          { key: "descripcion", label: "Descripción" },
          { key: "causa", label: "Causa" },
          { key: "solucion", label: "Solución" },
          { key: "casoResuelto", label: "Resuelto" },
        ]}
        actions={(row) => (
          <Button secondary onClick={() => setModal({ kind: "edit", row })}>
            Editar artículo
          </Button>
        )}
      />
      <h3 className="font-bold">Propuestas técnicas</h3>
      <Table
        source={proposals}
        label="Propuestas técnicas"
        columns={[
          { key: "id", label: "Propuesta" },
          {
            key: "contenido",
            label: "Código / solución",
            value: (row) =>
              [row.contenido?.codigoObd, row.contenido?.solucion]
                .filter(Boolean)
                .join(" · "),
          },
          { key: "estado", label: "Estado" },
        ]}
        actions={(row) =>
          session.role === "admin" &&
          row.estado === "PENDIENTE" && (
            <>
              <Button
                disabled={action.busy}
                onClick={() =>
                  action.run(() =>
                    session.mutate(
                      "POST",
                      "/workshop-flow/obd/propuestas/" + row.id + "/resolver",
                      { decision: "APROBAR" },
                    ),
                  )
                }
              >
                Aprobar propuesta
              </Button>
              <Button
                secondary
                disabled={action.busy}
                onClick={() =>
                  action.run(() =>
                    session.mutate(
                      "POST",
                      "/workshop-flow/obd/propuestas/" + row.id + "/resolver",
                      { decision: "RECHAZAR" },
                    ),
                  )
                }
              >
                Rechazar propuesta
              </Button>
            </>
          )
        }
      />
      {modal && (
        <Dialog
          title={
            modal.kind === "proposal" ? "Proponer solución" : "Artículo técnico"
          }
          onClose={() => setModal(null)}
        >
          <Form
            title="Conocimiento OBD"
            fields={knowledgeFields}
            initial={modal.row || { casoResuelto: "NO" }}
            onSubmit={async (data) => {
              await session.mutate(
                modal.kind === "edit" ? "PUT" : "POST",
                modal.kind === "proposal"
                  ? "/workshop-flow/obd/proponer"
                  : endpoint("OBDCONOCIMIENTO") +
                      (modal.row ? "/" + modal.row.id : ""),
                data,
              );
              setModal(null);
            }}
          />
        </Dialog>
      )}
    </Panel>
  );
}
function Notices() {
  const session = useContext(Context),
    source = useData("/workshop-flow/notificaciones"),
    alerts = useData(
      session.role === "client" ? null : "/workshop-flow/alertas",
    ),
    action = useAction();
  return (
    <div className="space-y-5">
      <Message error>{action.error}</Message>
      <Panel title="Mis notificaciones">
        <Table
          source={source}
          label="Notificaciones"
          columns={[
            { key: "fecha", label: "Fecha", value: (row) => date(row.fecha) },
            { key: "tipo", label: "Tipo" },
            { key: "mensaje", label: "Mensaje" },
            { key: "leida", label: "Leída" },
          ]}
          actions={(row) =>
            !row.leida && (
              <Button
                secondary
                disabled={action.busy}
                onClick={() =>
                  action.run(() =>
                    session.mutate(
                      "POST",
                      "/workshop-flow/notificaciones/" + row.id + "/leida",
                      {},
                    ),
                  )
                }
              >
                Marcar como leída
              </Button>
            )
          }
        />
      </Panel>
      {session.role !== "client" && (
        <Panel title="Alertas de existencias">
          <Table
            source={alerts}
            label="Alertas activas"
            columns={[
              { key: "productoId", label: "Repuesto" },
              { key: "existenciasActuales", label: "Existencias" },
              { key: "stockMinimo", label: "Mínimo" },
              { key: "estado", label: "Estado" },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
function saveCsv(filename, rows) {
  const escape = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const body =
    "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(
      new Blob([body], { type: "text/csv;charset=utf-8" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Reports() {
  const [range, setRange] = useState({
      desde: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      hasta: new Date().toISOString().slice(0, 10),
    }),
    [applied, setApplied] = useState(range);
  const source = useData(
      "/workshop-flow/indicadores?desde=" +
        applied.desde +
        "T00:00:00.000Z&hasta=" +
        applied.hasta +
        "T23:59:59.999Z",
    ),
    indicators = source.data?.indicadores || {};
  const names = {
    vehiculos: "Vehículos registrados",
    ordenes: "Órdenes registradas",
    ventas: "Ventas del período",
    ingresos: "Ingresos del período",
    stockBajo: "Alertas de stock",
  };
  return (
    <Panel title="Indicadores y reportes">
      <Form
        title="Período del informe"
        successMessage="Filtro aplicado."
        fields={[
          field("desde", "Desde", "date", { required: true }),
          field("hasta", "Hasta", "date", { required: true }),
        ]}
        initial={range}
        reset={false}
        submit="Consultar informe"
        onSubmit={async (data) => {
          if (data.desde > data.hasta)
            throw new Error(
              "La fecha inicial debe ser anterior o igual a la final.",
            );
          setRange(data);
          setApplied(data);
        }}
      />
      <State source={source} />
      <p className="text-sm text-slate-600">
        Las ventas y los ingresos corresponden al período consultado; vehículos
        y órdenes muestran el total registrado.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(indicators).map(([key, value]) => (
          <div className="rounded-xl border bg-indigo-50 p-4" key={key}>
            <p className="text-sm text-slate-600">{names[key] || key}</p>
            <strong className="text-2xl">
              {key === "ingresos" ? money(value) : text(value)}
            </strong>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={
            source.loading ||
            Boolean(source.error) ||
            !Object.keys(indicators).length
          }
          onClick={() =>
            saveCsv(
              "indicadores-" + applied.desde + "-" + applied.hasta + ".csv",
              [
                ["Indicador", "Valor", "Desde", "Hasta"],
                ...Object.entries(indicators).map(([key, value]) => [
                  names[key] || key,
                  value,
                  applied.desde,
                  applied.hasta,
                ]),
              ],
            )
          }
        >
          Descargar CSV
        </Button>
        <Button
          secondary
          onClick={() => window.print()}
          disabled={source.loading || Boolean(source.error)}
        >
          Imprimir informe
        </Button>
      </div>
    </Panel>
  );
}
function Audit() {
  const source = useRows("AUDITORIA");
  return (
    <Panel title="Auditoría">
      <p className="text-sm text-slate-600">
        Registro de operaciones conservado por el servidor. No se permite
        editarlo desde esta pantalla.
      </p>
      <Table
        source={source}
        label="Auditoría"
        columns={[
          {
            key: "fechaHora",
            label: "Fecha",
            value: (row) => date(row.fechaHora),
          },
          { key: "usuarioId", label: "Responsable" },
          { key: "operacion", label: "Operación" },
          { key: "entidad", label: "Entidad" },
          { key: "entidadId", label: "Registro" },
          { key: "resultado", label: "Resultado" },
        ]}
      />
    </Panel>
  );
}
function Dashboard() {
  const session = useContext(Context),
    vehicles = useData(
      session.role === "client" ? "/mi/vehiculos" : endpoint("VEHICULO"),
    ),
    orders = useData("/workshop-flow/progreso"),
    notices = useData("/workshop-flow/notificaciones");
  return (
    <div className="space-y-5">
      <Panel
        title={
          "Bienvenido, " +
          (session.user.nombre || session.user.username || session.user.role)
        }
      >
        <p>Consulta tus registros y continúa las tareas del taller.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Vehículos", vehicles, "vehiculos"],
            ["Órdenes accesibles", orders, "ordenes"],
            ["Notificaciones sin leer", notices, "notificaciones"],
          ].map(([label, source, key]) => (
            <div key={key} className="rounded-xl border p-4">
              <h3 className="font-semibold">{label}</h3>
              <State source={source} />
              {!source.error && !source.loading && (
                <p className="my-2 text-3xl font-bold">
                  {key === "notificaciones"
                    ? source.rows.filter((row) => !row.leida).length
                    : source.rows.length}
                </p>
              )}
              <Button secondary onClick={() => session.navigate(key)}>
                Abrir {label.toLowerCase()}
              </Button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Accesos de trabajo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {config.modules
            .filter(
              (module) =>
                module.roles.includes(session.role) &&
                module.key !== "dashboard",
            )
            .map((module) => (
              <Button
                secondary
                key={module.key}
                onClick={() => session.navigate(module.key)}
              >
                {module.label}
              </Button>
            ))}
        </div>
      </Panel>
    </div>
  );
}
const views = {
  dashboard: Dashboard,
  usuarios: Accounts,
  roles: Permissions,
  clientes: Customers,
  vehiculos: Vehicles,
  citas: Appointments,
  recepcion: Intake,
  diagnostico: Diagnosis,
  servicios: Services,
  cotizaciones: Quotes,
  ordenes: Orders,
  productos: Products,
  ventas: () => <Commerce />,
  compras: () => <Commerce purchase />,
  expediente: History,
  mantenimiento: Maintenance,
  conocimiento: Knowledge,
  notificaciones: Notices,
  reportes: Reports,
  auditoria: Audit,
};
function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-center text-3xl font-bold text-slate-900">
          {config.projectName}
        </h1>
        <p className="text-center text-slate-600">
          Accede a tu espacio de trabajo.
        </p>
        <Form
          key={mode}
          title={
            mode === "login"
              ? "Iniciar sesión"
              : mode === "recover"
                ? "Recuperar acceso"
                : "Verificar recuperación"
          }
          fields={
            mode === "login"
              ? [
                  field("email", "Correo", "email", { required: true }),
                  field("password", "Contraseña", "password", {
                    required: true,
                  }),
                ]
              : mode === "recover"
                ? [
                    field("email", "Correo de la cuenta", "email", {
                      required: true,
                    }),
                  ]
                : [
                    field("token", "Código recibido", "text", {
                      required: true,
                    }),
                    field("password", "Nueva contraseña", "password", {
                      required: true,
                      minLength: 8,
                    }),
                    field("confirmation", "Confirmar contraseña", "password", {
                      required: true,
                      minLength: 8,
                    }),
                  ]
          }
          submit={
            mode === "login"
              ? "Entrar"
              : mode === "recover"
                ? "Enviar instrucciones"
                : "Actualizar contraseña"
          }
          onSubmit={async (data) => {
            if (mode === "login") {
              const response = await api.post("/auth/login", data);
              localStorage.setItem("token", response.token);
              const verified = await api.get("/auth/me");
              const account = verified.user || verified;
              localStorage.setItem("user", JSON.stringify(account));
              onLogin(account);
            } else if (mode === "recover") {
              try {
                await api.post("/auth/recover", data);
              } catch (error) {
                if (
                  ["MAIL_NOT_CONFIGURED", "MAIL_UNAVAILABLE"].includes(
                    error.details?.code,
                  )
                )
                  throw new Error(
                    "La recuperación por correo no está disponible. Solicita ayuda al administrador.",
                  );
                throw error;
              }
              setMode("confirm");
            } else {
              if (data.password !== data.confirmation)
                throw new Error("Las contraseñas no coinciden.");
              await api.post("/auth/recover/confirm", {
                token: data.token,
                password: data.password,
              });
              setMode("login");
            }
          }}
        />
        <div className="flex flex-wrap justify-center gap-3">
          {mode !== "login" && (
            <Button secondary onClick={() => setMode("login")}>
              Volver al acceso
            </Button>
          )}
          {mode === "login" && (
            <Button secondary onClick={() => setMode("recover")}>
              Recuperar acceso
            </Button>
          )}
          {mode !== "confirm" && (
            <Button secondary onClick={() => setMode("confirm")}>
              Ya tengo un código
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
function PasswordChange({ onDone }) {
  return (
    <main className="mx-auto max-w-xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">Cambia tu contraseña temporal</h1>
      <p>Define una contraseña personal para continuar.</p>
      <Form
        title="Cambio obligatorio de contraseña"
        fields={[
          field("claveActual", "Contraseña temporal", "password", {
            required: true,
          }),
          field("nuevaClave", "Nueva contraseña", "password", {
            required: true,
            minLength: 8,
          }),
          field("confirmacion", "Confirmar contraseña", "password", {
            required: true,
            minLength: 8,
          }),
        ]}
        submit="Guardar contraseña"
        onSubmit={async (data) => {
          if (data.nuevaClave !== data.confirmacion)
            throw new Error("Las contraseñas no coinciden.");
          await api.post("/auth/change-password", {
            claveActual: data.claveActual,
            nuevaClave: data.nuevaClave,
          });
          onDone();
        }}
      />
      <Button secondary onClick={onDone}>
        Cerrar sesión
      </Button>
    </main>
  );
}
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Panel title="No se pudo abrir esta pantalla">
        <p>Vuelve a cargar la aplicación para reintentar.</p>
        <Button onClick={() => window.location.reload()}>
          Volver a cargar
        </Button>
      </Panel>
    ) : (
      this.props.children
    );
  }
}
export default function WorkshopWorkspace() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(Boolean(localStorage.getItem("token"))),
    [loginError, setLoginError] = useState(""),
    [location, setLocation] = useState(readLocation),
    [notice, setNotice] = useState(""),
    [secret, setSecret] = useState(null);
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSecret(null);
    setNotice("");
  }, []);
  useEffect(() => {
    let active = true;
    if (localStorage.getItem("token"))
      api
        .get("/auth/me")
        .then((response) => {
          if (active) setUser(response.user || response);
        })
        .catch((error) => {
          if (active) {
            logout();
            setLoginError(error.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const expired = () => {
      logout();
      setLoginError("La sesión terminó. Inicia sesión nuevamente.");
    };
    window.addEventListener("auth:expired", expired);
    return () => {
      active = false;
      window.removeEventListener("auth:expired", expired);
    };
  }, [logout]);
  useEffect(() => {
    const changed = () => setLocation(readLocation());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const role = roleKey(user),
    navigate = (key, query = {}) => {
      setSecret(null);
      setNotice("");
      const suffix = new URLSearchParams(query).toString();
      window.location.hash = key + (suffix ? "?" + suffix : "");
      setLocation({ key, query: new URLSearchParams(query) });
    };
  const can = (method, url) => {
    if (!user) return false;
    const canonical = (url.startsWith("/api/") ? url : "/api" + url).replace(
        /\/[0-9]+(?=\/|$)/g,
        "/:id",
      ),
      code = method + ":" + canonical;
    const explicit = (user.permissions || []).find(
      (item) => item.codigo === code,
    );
    if (explicit) return explicit.permitido;
    const group = Object.keys(config.permissionGroups).find((key) =>
        config.permissionGroups[key].includes(code),
      ),
      override = (user.permissions || []).find((item) => item.codigo === group);
    if (override) return override.permitido;
    let allowed = config.adapterPermissions[code];
    if (!allowed) {
      const resource = Object.values(config.resources).find(
        (item) =>
          canonical === item.endpoint || canonical === item.endpoint + "/:id",
      );
      allowed =
        resource?.roles[method] ||
        Object.values(config.operations).find((item) => item.path === canonical)
          ?.roles ||
        [];
    }
    return allowed.includes(user.role);
  };
  const mutate = async (method, url, payload) => {
    setNotice("");
    const data = await api.request(url, { method, body: payload });
    if (url === "/workshop-flow/permisos" && payload.rol === user.role)
      setUser((current) => ({
        ...current,
        permissions: [
          ...(current.permissions || []).filter(
            (item) => item.codigo !== payload.codigo,
          ),
          { codigo: payload.codigo, permitido: data.permitido },
        ],
      }));
    if (data?.passwordTemporal)
      setSecret({ correo: data.correo, password: data.passwordTemporal });
    setNotice("Operación guardada correctamente.");
    window.dispatchEvent(new Event("workshop:updated"));
    return data;
  };
  if (loading)
    return (
      <main className="p-10" role="status">
        Verificando sesión…
      </main>
    );
  if (!user)
    return (
      <>
        <div className="mx-auto max-w-lg px-4 pt-4">
          <Message error>{loginError}</Message>
        </div>
        <Login
          onLogin={(next) => {
            setLoginError("");
            setUser(next);
            navigate("dashboard");
          }}
        />
      </>
    );
  if (!role)
    return (
      <main className="p-6">
        <Message error>
          Tu cuenta no tiene un rol habilitado para este taller.
        </Message>
        <Button onClick={logout}>Cerrar sesión</Button>
      </main>
    );
  if (user.cambioObligatorio)
    return (
      <PasswordChange
        onDone={() => {
          logout();
          setLoginError("Inicia sesión con tu contraseña personal.");
        }}
      />
    );
  const modules = config.modules.filter((module) =>
      module.roles.includes(role),
    ),
    active = modules.find((module) => module.key === location.key),
    View = active ? views[active.key] : null;
  const session = { user, role, can, mutate, navigate, location };
  return (
    <Context.Provider value={session}>
      <AppShell
        title={config.projectName}
        user={user}
        onLogout={logout}
        navItems={modules}
        activeTab={active?.key || ""}
        onSelectTab={navigate}
      >
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
          <Message>{notice}</Message>
          {secret && (
            <Panel title="Clave temporal generada">
              <p>Cuenta: {secret.correo}</p>
              <p className="select-all rounded-lg bg-slate-100 p-3 font-mono break-all">
                {secret.password}
              </p>
              <p className="text-sm">
                Entrega esta clave al usuario por un medio privado. Se muestra
                solo durante esta sesión de pantalla.
              </p>
              <Button secondary onClick={() => setSecret(null)}>
                Ocultar clave
              </Button>
            </Panel>
          )}
          {View ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {active.label}
                </h1>
                <Button
                  secondary
                  onClick={() =>
                    window.dispatchEvent(new Event("workshop:updated"))
                  }
                >
                  Actualizar datos
                </Button>
              </div>
              <Boundary key={active.key}>
                <View key={active.key + "?" + location.query.toString()} />
              </Boundary>
            </>
          ) : (
            <Panel title="Pantalla no disponible">
              <p>Esta opción no está habilitada para tu rol.</p>
              <Button onClick={() => navigate("dashboard")}>
                Ir al inicio
              </Button>
            </Panel>
          )}
        </div>
      </AppShell>
    </Context.Provider>
  );
}
