const http = require("http");
const https = require("https");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const API_HOST = "resultadosegundavuelta.onpe.gob.pe";
const API_BASE = "/presentacion-backend/resumen-general";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const API_ROUTES = {
  "/api/totales": `${API_BASE}/totales?idEleccion=10&tipoFiltro=eleccion`,
  "/api/participantes": `${API_BASE}/participantes?idEleccion=10&tipoFiltro=eleccion`
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function isAdminRequest(req) {
  const authorization = req.headers.authorization || "";
  const prefix = "Basic ";

  if (!authorization.startsWith(prefix)) return false;

  try {
    const decoded = Buffer.from(authorization.slice(prefix.length), "base64").toString("utf8");
    return decoded === `${ADMIN_USER}:${ADMIN_PASSWORD}`;
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;

  res.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="ONPE Admin"'
  });
  res.end(JSON.stringify({ success: false, message: "Credenciales invalidas.", data: null }));
  return false;
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function readSettings() {
  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function readBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error("El cuerpo de la peticion supera el limite permitido.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function parseMultipartFile(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const chunks = splitBuffer(buffer, boundaryBuffer);

  for (const chunk of chunks) {
    const headerEnd = chunk.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headerText = chunk.subarray(0, headerEnd).toString("latin1");
    const filenameMatch = headerText.match(/filename="([^"]*)"/i);
    const typeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = typeMatch ? typeMatch[1].trim().toLowerCase() : "";
    const hasImageField = /name="?image"?/i.test(headerText);
    const hasImageFile = Boolean(filenameMatch) && contentType.startsWith("image/");

    if (!hasImageField && !hasImageFile) continue;

    let file = chunk.subarray(headerEnd + 4);

    if (file.subarray(0, 2).toString("latin1") === "\r\n") {
      file = file.subarray(2);
    }

    if (file.subarray(-2).toString("latin1") === "\r\n") {
      file = file.subarray(0, -2);
    }

    if (file.subarray(-2).toString("latin1") === "--") {
      file = file.subarray(0, -2);
    }

    return {
      filename: filenameMatch ? filenameMatch[1] : "imagen",
      contentType,
      file
    };
  }

  return null;
}

function extensionForImage(contentType, filename, file) {
  const byType = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };

  if (byType[contentType]) return byType[contentType];

  const extension = path.extname(filename || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension) ? extension : "";
}

function extensionForImageBytes(file) {
  if (!file || file.length < 4) return "";

  if (file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return ".png";
  }

  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    return ".jpg";
  }

  if (file.subarray(0, 4).toString("latin1") === "GIF8") {
    return ".gif";
  }

  if (file.length >= 12 && file.subarray(0, 4).toString("latin1") === "RIFF" && file.subarray(8, 12).toString("latin1") === "WEBP") {
    return ".webp";
  }

  return "";
}

async function handleSettings(req, res) {
  if (req.method === "GET") {
    const settings = await readSettings();
    sendJson(res, 200, { success: true, message: "", data: settings });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, message: "Metodo no permitido.", data: null });
    return;
  }

  if (!requireAdmin(req, res)) return;

  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body.toString("utf8"));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Configuracion invalida.");
    }

    await ensureStorage();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(parsed, null, 2));
    sendJson(res, 200, { success: true, message: "", data: parsed });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message, data: null });
  }
}

async function handleImageUpload(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, message: "Metodo no permitido.", data: null });
    return;
  }

  if (!requireAdmin(req, res)) return;

  try {
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

    if (!boundaryMatch) {
      throw new Error("No se encontro el limite multipart.");
    }

    const body = await readBody(req, MAX_UPLOAD_BYTES);
    const upload = parseMultipartFile(body, boundaryMatch[1] || boundaryMatch[2]);

    if (!upload || !upload.file.length) {
      throw new Error("No se recibio una imagen.");
    }

    const extension = extensionForImage(upload.contentType, upload.filename, upload.file) || extensionForImageBytes(upload.file);

    if (!extension) {
      throw new Error("Formato no permitido. Usa PNG, JPG, WEBP o GIF.");
    }

    await ensureStorage();

    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
    const target = path.join(UPLOAD_DIR, name);

    await fs.writeFile(target, upload.file);
    sendJson(res, 200, {
      success: true,
      message: "",
      data: {
        url: `/public/uploads/${name}`,
        filename: name
      }
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message, data: null });
  }
}

function proxyOnpe(routePath, res) {
  const headers = {
    accept: "*/*",
    "accept-language": "es-ES,es;q=0.9",
    "content-type": "application/json",
    referer: "https://resultadosegundavuelta.onpe.gob.pe/main/resumen",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  };

  if (process.env.ONPE_COOKIE) {
    headers.cookie = process.env.ONPE_COOKIE;
  }

  const request = https.request(
    {
      hostname: API_HOST,
      path: API_ROUTES[routePath],
      method: "GET",
      headers,
      timeout: 12000
    },
    (apiRes) => {
      const chunks = [];

      apiRes.on("data", (chunk) => chunks.push(chunk));
      apiRes.on("end", () => {
        const body = Buffer.concat(chunks);
        const contentType = apiRes.headers["content-type"] || "application/json; charset=utf-8";

        res.writeHead(apiRes.statusCode || 502, {
          "Content-Type": contentType,
          "Cache-Control": "no-store"
        });
        res.end(body);
      });
    }
  );

  request.on("timeout", () => {
    request.destroy(new Error("Tiempo de espera agotado al consultar ONPE."));
  });

  request.on("error", (error) => {
    sendJson(res, 502, {
      success: false,
      message: error.message,
      data: null
    });
  });

  request.end();
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(cleanPath);
  const filePath = path.resolve(ROOT, `.${decodedPath}`);

  const rootBoundary = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;

  if (filePath !== ROOT && !filePath.startsWith(rootBoundary)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acceso denegado");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }

    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (API_ROUTES[pathname]) {
    proxyOnpe(pathname, res);
    return;
  }

  if (pathname === "/api/settings") {
    handleSettings(req, res);
    return;
  }

  if (pathname === "/api/upload-image") {
    handleImageUpload(req, res);
    return;
  }

  serveStatic(pathname, res);
});

server.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
