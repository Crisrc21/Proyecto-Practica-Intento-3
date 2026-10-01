export function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(JSON.stringify(payload));
}
