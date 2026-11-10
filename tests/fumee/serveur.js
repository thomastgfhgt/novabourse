/* Petit serveur local pour le test de fumée : sert les fichiers du site
   et répond à /api/config?format=js sans configuration (window.NT_SB =
   null), comme un aperçu local. Aucune autre route /api n'est servie :
   le site doit rester utilisable sans elles. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};

function demarrer(port = 0) {
  const serveur = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      return res.end('window.NT_SB = null;\n');
    }
    if (url.pathname.startsWith('/api/')) { res.writeHead(404); return res.end(); }
    let fichier = path.normalize(path.join(RACINE, decodeURIComponent(url.pathname)));
    if (!fichier.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
    if (url.pathname === '/' ) fichier = path.join(RACINE, 'index.html');
    fs.readFile(fichier, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => serveur.listen(port, '127.0.0.1', () => resolve(serveur)));
}

module.exports = { demarrer };
