const COMMON_PORTS = new Set([
  3000, 3001, 3002, 4000, 4200, 5000, 5173, 6006,
  8000, 8080, 8888, 9000, 9090,
]);

const PORT_PATTERNS = [
  /listening on.*?:(\d{2,5})/i,
  /http:\/\/(?:localhost|0\.0\.0\.0):(\d{2,5})/i,
  /started.*?port[:\s]+(\d{2,5})/i,
  /running on.*?:(\d{2,5})/i,
  /server.*?port[:\s]+(\d{2,5})/i,
  /port[:\s]+(\d{2,5})/i,
];

const FALLBACK_PATTERN = /:(\d{4,5})\b/;

let detectedPort = null;

export function detectPort(line) {
  if (detectedPort) return null; // already found one

  for (const pattern of PORT_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port > 1024 && port < 65536) {
        detectedPort = port;
        return port;
      }
    }
  }

  // Fallback: only trust if it's a well-known dev port
  const fallback = line.match(FALLBACK_PATTERN);
  if (fallback) {
    const port = parseInt(fallback[1], 10);
    if (COMMON_PORTS.has(port)) {
      detectedPort = port;
      return port;
    }
  }

  return null;
}

export function resetPortDetector() {
  detectedPort = null;
}
